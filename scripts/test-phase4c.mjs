#!/usr/bin/env node
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';

const root = process.env.RECON_ROOT;
const bootstrap = process.env.FREELANG_V11_ROOT &&
  join(process.env.FREELANG_V11_ROOT, 'bootstrap.js');
const afjRoot = process.env.AFJ_DB_ROOT;
if (!root || !bootstrap || !afjRoot) {
  throw new Error('RECON_ROOT, FREELANG_V11_ROOT, and AFJ_DB_ROOT are required');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function waitForOutput(child, expected) {
  return new Promise((resolve, reject) => {
    let output = '';
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout?.off('data', onData);
      child.stderr?.off('data', onData);
      child.off('exit', onExit);
      child.off('error', onError);
    };
    const finish = (error) => {
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes(expected)) finish();
    };
    const onExit = (code, signal) => finish(new Error(`process exited ${code ?? signal}: ${output}`));
    const onError = (error) => finish(error);
    const timer = setTimeout(() => finish(new Error(`timeout waiting for ${expected}: ${output}`)), 30000);
    timer.unref();
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('exit', onExit);
    child.once('error', onError);
  });
}

async function startDb(port, wal) {
  const child = spawn(process.execPath,
    [bootstrap, 'run', join(afjRoot, 'tests/tcp-daemon.fls')], {
      cwd: afjRoot,
      env: { ...process.env, AFJ_DB_MODE: 'development',
        AFJ_DB_PORT: String(port), AFJ_DB_BIND_HOST: '127.0.0.1',
        AFJ_DB_ROOT_PASSWORD: 'development-only',
        AFJ_DB_WAL: wal,
        AFJ_DB_AUTH_STATE: join(scratch, `auth-${port}.jsonl`),
        AFJ_DB_AUDIT_LOG: join(scratch, `audit-${port}.jsonl`),
        AFJ_DB_CATALOG_PAGES: join(scratch, `pages-${port}`) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  try {
    await waitForOutput(child, 'TCP server STARTED');
  } catch (error) {
    await stopAndWait(child, 'SIGKILL');
    throw error;
  }
  return child;
}

function runRecon(file, env) {
  const result = spawnSync(process.execPath, [bootstrap, 'run', join(root, file)], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.status !== 0) {
    throw new Error(`${file} failed:\n${result.stdout}\n${result.stderr}`);
  }
  process.stdout.write(result.stdout);
}

async function stopAndWait(child, signal = 'SIGTERM') {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`child did not exit after ${signal}`)), 5000);
    timer.unref();
    child.once('exit', (code, childSignal) => {
      clearTimeout(timer);
      resolve({ code, signal: childSignal });
    });
  });
  child.kill(signal);
  await exited;
}

const scratch = mkdtempSync(join(tmpdir(), 'freelang-recon-phase4c.'));
let daemon;
let writer;
try {
  const port = await freePort();
  const env = { RECON_AFJ_HOST: '127.0.0.1', RECON_AFJ_PORT: String(port),
    RECON_AFJ_PASSWORD: 'development-only' };
  daemon = await startDb(port, join(scratch, 'smoke.wal'));
  runRecon('tests/phase4c-adapter.fl', env);
  await stopAndWait(daemon);

  daemon = await startDb(port, join(scratch, 'fault.wal'));
  writer = spawn(process.execPath, [bootstrap, 'run', join(root, 'tests/phase4c-fault-writer.fl')], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForOutput(writer, 'PHASE4C_WRITER_READY');
  await stopAndWait(daemon, 'SIGKILL');
  await stopAndWait(writer, 'SIGKILL');

  daemon = await startDb(port, join(scratch, 'fault.wal'));
  runRecon('tests/phase4c-recovery.fl', env);
  console.log('PHASE4C_ATOMICITY=PASS_UNCOMMITTED_BATCH_ABSENT');
} finally {
  await Promise.allSettled([stopAndWait(writer, 'SIGKILL'), stopAndWait(daemon)]);
  rmSync(scratch, { recursive: true, force: true });
}
