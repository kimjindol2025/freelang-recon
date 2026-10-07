import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const path = process.argv[2];
if (!path) {
  process.stderr.write("usage: evidence-id.mjs <canonical-file>\n");
  process.exit(2);
}

const canonical = await readFile(path, "utf8");
const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
process.stdout.write(`${digest.slice(0, 16)}\n`);
