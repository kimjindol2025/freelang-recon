#!/usr/bin/env node
// Phase 4-B failure/consistency checks at the AFJ DB host boundary.
import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const cli = process.env.AFJ_DB_CLI;
if (!cli) throw new Error('AFJ_DB_CLI is required');

function call(db, args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });
  if (result.error) throw result.error;
  const raw = String(result.stdout || '').trim();
  let data;
  try { data = JSON.parse(raw); } catch (error) {
    throw new Error(`AFJ returned invalid JSON: ${raw || result.stderr}`);
  }
  return { status: result.status, data };
}

function requireOk(label, result) {
  if (result.status !== 0 || result.data?.ok !== true) {
    throw new Error(`${label} failed: ${JSON.stringify(result.data)}`);
  }
  return result.data;
}

function requireTrue(label, condition) {
  if (!condition) throw new Error(`${label} failed`);
  console.log(`${label}=PASS`);
}

const root = mkdtempSync(join(tmpdir(), 'freelang-recon-phase4b.'));
const db = join(root, 'db');
const batchDb = join(root, 'batch-db');
mkdirSync(db, { recursive: true });
mkdirSync(batchDb, { recursive: true });

try {
  requireOk('SEED_APPEND', call(db, ['append', db, 'evidence-1', '{"complete":true}', '1800000000001']));
  const before = requireOk('VERIFY_BEFORE_FAILURE', call(db, ['verify', db]));
  requireTrue('PARTIAL_SAVE_BASELINE', before.records === 1);

  // Simulate a process dying after writing a structurally valid but invalid event.
  // The malformed hash makes the partial state observable and recoverable.
  const log = join(db, 'log.jsonl');
  appendFileSync(log, '{"seq":2,"ts":1800000000002,"key":"evidence-2","op":"put","value":{"complete":false},"prev":"bad-prev","hash":"bad-hash"}\n');
  const damaged = call(db, ['verify', db]);
  requireTrue('PARTIAL_SAVE_DETECTED', damaged.data?.ok === false && damaged.data?.errors?.length > 0);
  console.log('INCOMPLETE_STATE=DISTINGUISHED');

  const recovered = requireOk('RECOVER', call(db, ['recover', db]));
  requireTrue('SINGLE_APPEND_RECOVERY', recovered.repaired === true && recovered.records_after === 1);
  const after = requireOk('VERIFY_AFTER_RECOVERY', call(db, ['verify', db]));
  requireTrue('MISSING_RECORD_DETECTION', after.records === 1 && after.key_count === 1);

  requireOk('RETRY_APPEND', call(db, ['append', db, 'evidence-2', '{"complete":true}', '1800000000002']));
  const retried = requireOk('VERIFY_RETRY', call(db, ['verify', db]));
  requireTrue('RETRY_NO_DUPLICATE', retried.records === 2 && retried.key_count === 2);

  const batch = requireOk('BATCH_APPEND', call(batchDb, ['append-batch', batchDb, JSON.stringify({ count: 5, key_prefix: 'batch', base_ts: 1800000001000 })]));
  const batchVerify = requireOk('BATCH_VERIFY', call(batchDb, ['verify', batchDb]));
  requireTrue('BATCH_APPEND_SUPPORTED', batch.records_added === 5 && batchVerify.records === 5);
  console.log('MULTI_RECORD_ATOMICITY=UNVERIFIED_FAILURE_INJECTION');
} finally {
  rmSync(root, { recursive: true, force: true });
}
