#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const helper = fileURLToPath(new URL("./realpath-boundary.mjs", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "recon-realpath-"));
const root = join(scratch, "root");
const inside = join(root, "inside");
const outside = join(scratch, "outside");
mkdirSync(inside, { recursive: true });
mkdirSync(outside);
symlinkSync(outside, join(root, "link-out"));
symlinkSync(join(scratch, "missing"), join(root, "link-broken"));
function check(target) {
  return spawnSync(process.execPath, [helper, target, root], { encoding: "utf8" });
}

try {
  assert.equal(JSON.parse(check(inside).stdout).ok, true);
  assert.equal(check(outside).status, 2);
  assert.equal(check(join(root, "link-out")).status, 2);
  assert.equal(check(join(root, "link-broken")).status, 2);
  assert.equal(check(join(root, "missing")).status, 2);
  process.stdout.write("REALPATH_BOUNDARY_CASES=PASS inside=1 outside=1 symlink=1 dangling=1 missing=1\n");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
