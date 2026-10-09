#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

function fail(error, code = 'E_AFJ_DB') {
  return { ok: false, code, error: String(error) };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function recordHasValidDigest(record) {
  return record && record.evidence_digest === digest(record.evidence);
}

function cliPath() {
  const value = process.env.AFJ_DB_CLI;
  if (!value) throw new Error('AFJ_DB_CLI is required');
  return value;
}

function runCli(dbDir, args) {
  const result = spawnSync(process.execPath, [cliPath(), ...args], {
    cwd: process.env.AFJ_DB_ROOT || undefined,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });
  if (result.error) return fail(result.error.message, 'E_AFJ_CLI');
  let data = null;
  try { data = JSON.parse(String(result.stdout || '').trim()); } catch {
    return fail(String(result.stderr || result.stdout || 'AFJ CLI returned invalid JSON').trim(), 'E_AFJ_PROTOCOL');
  }
  if (result.status !== 0) return fail(data?.error || result.stderr || 'AFJ CLI failed', data?.code || 'E_AFJ_CLI');
  return { ok: true, data };
}

async function save(dbDir, evidenceFile) {
  const evidence = JSON.parse(await readFile(evidenceFile, 'utf8'));
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return fail('evidence must be an object', 'E_INVALID_EVIDENCE');
  const evidenceDigest = digest(evidence);
  const key = `recon:evidence:${evidenceDigest}`;
  const existing = runCli(dbDir, ['read-key', dbDir, key]);
  if (existing.ok && existing.data?.value != null) {
    if (existing.data?.value?.evidence_digest !== evidenceDigest) {
      return fail('existing key contains a different evidence digest', 'E_IDEMPOTENCY_CONFLICT');
    }
    if (!recordHasValidDigest(existing.data.value)) {
      return fail('existing evidence digest does not match its payload', 'E_HASH_INTEGRITY');
    }
    return { ok: true, status: 'idempotent', key, evidence_digest: evidenceDigest, record: existing.data.value };
  }
  const record = {
    schema: 'recon/evidence-record/v1',
    evidence_digest: evidenceDigest,
    evidence_id: evidence.evidence_id || null,
    artifact_sha256: evidence.artifact?.sha256 || null,
    kind: evidence.kind || null,
    evidence,
    provider: process.env.RECON_PROVIDER || 'local-recon',
    provider_version: process.env.RECON_PROVIDER_VERSION || 'phase4-a',
    source_commit: process.env.RECON_SOURCE_COMMIT || null,
  };
  const appended = runCli(dbDir, ['append', dbDir, key, JSON.stringify(record)]);
  if (!appended.ok) return appended;
  const stored = runCli(dbDir, ['read-key', dbDir, key]);
  if (!stored.ok || stored.data?.value?.evidence_digest !== evidenceDigest || !recordHasValidDigest(stored.data.value)) {
    return fail(`stored evidence digest mismatch expected=${evidenceDigest} actual=${stored.data?.value?.evidence_digest || 'missing'} recomputed=${stored.data?.value ? digest(stored.data.value.evidence) : 'missing'}`, 'E_HASH_INTEGRITY');
  }
  return { ok: true, status: 'saved', key, evidence_digest: evidenceDigest, record: stored.data.value, event: appended.data.event, head_hash: appended.data.head_hash };
}

function get(dbDir, evidenceDigest) {
  const key = evidenceDigest.startsWith('recon:evidence:') ? evidenceDigest : `recon:evidence:${evidenceDigest}`;
  const result = runCli(dbDir, ['read-key', dbDir, key]);
  if (!result.ok) return result;
  if (!recordHasValidDigest(result.data?.value)) return fail('stored evidence digest mismatch', 'E_HASH_INTEGRITY');
  return { ok: true, key, record: result.data.value, seq: result.data.seq };
}

function verify(dbDir) {
  const result = runCli(dbDir, ['verify', dbDir]);
  return result.ok ? { ok: result.data?.ok === true, verification: result.data } : result;
}

async function main() {
  const [, , command, dbDir, argument] = process.argv;
  if (!command || !dbDir) { process.stdout.write(JSON.stringify(fail('usage: afldb-evidence.mjs <save|get|verify> <db-dir> [file|digest]'))); return; }
  try {
    const result = command === 'save' ? await save(dbDir, argument)
      : command === 'get' ? get(dbDir, argument || '')
        : command === 'verify' ? verify(dbDir)
          : fail(`unknown command: ${command}`, 'E_USAGE');
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stdout.write(JSON.stringify(fail(error instanceof Error ? error.message : String(error), 'E_RUNTIME')));
  }
}

await main();
