#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, openSync, writeSync, closeSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { hashRange } from "./native-bytes.mjs";
import { fileURLToPath } from "node:url";

const scratch = mkdtempSync(join(tmpdir(), "recon-native-bytes-"));
const root = join(scratch, "allowed");
const outside = join(scratch, "outside");
mkdirSync(root);
mkdirSync(outside);
const file = join(root, "range.bin");
writeFileSync(file, "abcdef");
const cli = fileURLToPath(new URL("./native-bytes.mjs", import.meta.url));

function invoke(...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8", env: { ...process.env, RECON_ROOT: root }
  });
}

try {
  assert.equal(await hashRange(file, 1, 3), createHash("sha256").update("bcd").digest("hex"));
  assert.equal(await hashRange(file, 6, 0), createHash("sha256").digest("hex"));
  await assert.rejects(hashRange(file, 0, 7), /range exceeds file length/);
  await assert.rejects(hashRange(file, 7, 0), /range exceeds file length/);

  const beyond = invoke("sha256_range", file, "0", "100");
  assert.equal(beyond.status, 2);
  assert.equal(JSON.parse(beyond.stdout).ok, false);
  const valid = invoke("sha256_range", file, "0", "6");
  assert.equal(valid.status, 0);
  assert.equal(JSON.parse(valid.stdout).length, 6);

  writeFileSync(join(outside, "secret.bin"), "private");
  symlinkSync(join(outside, "secret.bin"), join(root, "outside-link"));
  const escaped = invoke("sha256_range", join(root, "outside-link"), "0", "7");
  assert.equal(escaped.status, 2);
  assert.equal(JSON.parse(escaped.stdout).ok, false);

  const changing = join(root, "changing.bin");
  const fd = openSync(changing, "w");
  writeSync(fd, Buffer.alloc(64 * 1024 * 1024, 0x41));
  closeSync(fd);
  await assert.rejects(hashRange(changing, 0, 64 * 1024 * 1024, (bytesRead) => {
    if (bytesRead !== 1024 * 1024) return;
    const mutator = openSync(changing, "r+");
    writeSync(mutator, Buffer.from([0x42]), 0, 1, 0);
    closeSync(mutator);
  }), /file changed while hashing/);
  process.stdout.write("NATIVE_BYTES_CASES=PASS eof=2 zero=1 partial=1 mutation=1 symlink=1\n");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
