import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const target = process.argv[2];
if (!target) {
  console.error("usage: native-capability-probe.mjs TARGET_FILE");
  process.exitCode = 2;
} else {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const stdinText = Buffer.concat(chunks).toString("utf8");
  const bytes = await readFile(target);
  const json = JSON.stringify(JSON.parse('{"name":"rea","phase":1}'));
  const digest = createHash("sha256").update(bytes).digest("hex");

  process.stdout.write(JSON.stringify({
    stdin_lines: stdinText.split(/\r?\n/),
    json_roundtrip: json,
    binary_bytes: bytes.length,
    sha256: digest,
    target,
  }) + "\n");
}
