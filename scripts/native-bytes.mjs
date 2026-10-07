import { open } from "node:fs/promises";
import { createReadStream } from "node:fs";
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

async function readRange(path, offset, length) {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(length);
    const result = await handle.read(buffer, 0, length, offset);
    if (result.bytesRead !== length) throw new Error("range exceeds file length");
    return buffer;
  } finally {
    await handle.close();
  }
}

async function filePrefix(path) {
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    const length = Math.min(16, stat.size);
    const buffer = Buffer.alloc(length);
    const result = await handle.read(buffer, 0, length, 0);
    return { path, file_size: stat.size, ok: result.bytesRead === length,
      length: result.bytesRead, base64: buffer.subarray(0, result.bytesRead).toString("base64") };
  } finally {
    await handle.close();
  }
}

async function hashRange(path, offset, length) {
  if (length === 0) return createHash("sha256").digest("hex");
  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path, { start: offset, end: offset + length - 1 });
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function parseRanges(value) {
  const ranges = JSON.parse(value);
  if (!Array.isArray(ranges)) throw new Error("ranges must be an array");
  return ranges.map((item) => {
    const offset = Number(item.offset);
    const length = Number(item.length);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("invalid offset");
    if (!Number.isSafeInteger(length) || length < 0) throw new Error("invalid length");
    return { id: item.id, offset, length };
  });
}

async function main() {
  const command = process.argv[2];
  const path = process.argv[3];
  if (!command || !path) {
    process.stdout.write(fail("usage: native-bytes.mjs <read_bytes|sha256_range|sha256_ranges> <path> ..."));
    return;
  }

  try {
    if (command === "read_bytes") {
      const { offset, length } = rangeArgs(process.argv.slice(4));
      const range = await readRange(path, offset, length);
      process.stdout.write(JSON.stringify({ ok: true, offset, length: range.length, base64: range.toString("base64") }));
      return;
    }

    if (command === "sha256_range") {
      const { offset, length } = rangeArgs(process.argv.slice(4));
      process.stdout.write(JSON.stringify({ ok: true, offset, length, sha256: await hashRange(path, offset, length) }));
      return;
    }

    if (command === "sha256_ranges") {
      const ranges = parseRanges(process.argv[4] || "[]");
      const hashes = [];
      for (const range of ranges) {
        hashes.push({ id: range.id, offset: range.offset, length: range.length,
          sha256: await hashRange(path, range.offset, range.length) });
      }
      process.stdout.write(JSON.stringify({ ok: true, hashes }));
      return;
    }

    if (command === "read_prefixes") {
      const paths = JSON.parse(path || "[]");
      if (!Array.isArray(paths)) throw new Error("paths must be an array");
      const prefixes = [];
      for (const item of paths) {
        try {
          prefixes.push(await filePrefix(String(item)));
        } catch (error) {
          prefixes.push({ path: String(item), ok: false,
            error: error instanceof Error ? error.message : String(error) });
        }
      }
      process.stdout.write(JSON.stringify({ ok: true, prefixes }));
      return;
    }

    process.stdout.write(fail(`unknown command: ${command}`));
  } catch (error) {
    process.stdout.write(fail(error instanceof Error ? error.message : String(error)));
  }
}

await main();
