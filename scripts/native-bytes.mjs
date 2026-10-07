import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

function fail(message) {
  return JSON.stringify({ ok: false, error: message });
}

function rangeArgs(args) {
  const offset = Number(args[0]);
  const length = Number(args[1]);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("invalid offset");
  if (!Number.isSafeInteger(length) || length < 0) throw new Error("invalid length");
  return { offset, length };
}

async function main() {
  const command = process.argv[2];
  const path = process.argv[3];
  if (!command || !path) {
    process.stdout.write(fail("usage: native-bytes.mjs <read_bytes|sha256_range> <path> <offset> <length>"));
    return;
  }

  try {
    const { offset, length } = rangeArgs(process.argv.slice(4));
    const bytes = await readFile(path);
    if (offset + length > bytes.length) throw new Error("range exceeds file length");
    const range = bytes.subarray(offset, offset + length);

    if (command === "read_bytes") {
      process.stdout.write(JSON.stringify({ ok: true, offset, length: range.length, base64: range.toString("base64") }));
      return;
    }

    if (command === "sha256_range") {
      process.stdout.write(JSON.stringify({ ok: true, offset, length: range.length, sha256: createHash("sha256").update(range).digest("hex") }));
      return;
    }

    process.stdout.write(fail(`unknown command: ${command}`));
  } catch (error) {
    process.stdout.write(fail(error instanceof Error ? error.message : String(error)));
  }
}

await main();
