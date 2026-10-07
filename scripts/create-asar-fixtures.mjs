import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve("/root/kilo-freelang/projects/freelang-recon/tests/fixtures");
const payloadParts = [Buffer.from("hello\n", "utf8"), Buffer.alloc(0), Buffer.from("nested", "utf8")];
const payload = Buffer.concat(payloadParts);
const digest = value => createHash("sha256").update(value).digest("hex");

const headerObject = {
  files: {
    "empty.txt": { size: 0, offset: "6", integrity: { algorithm: "SHA256", hash: digest(payloadParts[1]) } },
    "hello.txt": { size: 6, offset: "0", integrity: { algorithm: "SHA256", hash: digest(payloadParts[0]) } },
    nested: { files: { "value.txt": { size: 6, offset: "6", integrity: { algorithm: "SHA256", hash: digest(payloadParts[2]) } } } },
    "external.bin": { size: 3, offset: "0", unpacked: true },
    "alias.txt": { link: "hello.txt" }
  }
};

function makeAsar(header, body = payload, options = {}) {
  const json = Buffer.from(JSON.stringify(header), "utf8");
  const padding = (4 - (json.length % 4)) % 4;
  const headerArea = 8 + json.length + padding;
  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(headerArea, 4);
  prefix.writeUInt32LE(headerArea - 4, 8);
  prefix.writeUInt32LE(json.length, 12);
  const result = Buffer.concat([Buffer.concat([prefix, json, Buffer.alloc(padding)]), body]);
  if (options.headerArea !== undefined) result.writeUInt32LE(options.headerArea, 4);
  return result;
}

await mkdir(root, { recursive: true });
const normal = makeAsar(headerObject);
await writeFile(path.join(root, "normal.asar"), normal);

const mutated = Buffer.from(normal);
mutated[normal.length - payload.length] ^= 0x01;
await writeFile(path.join(root, "mutated.asar"), mutated);
await writeFile(path.join(root, "truncated.asar"), normal.subarray(0, normal.length - 2));

const brokenJson = Buffer.from(normal);
const jsonStart = 16;
brokenJson[jsonStart] = 0x7b;
brokenJson[jsonStart + 1] = 0x22;
brokenJson[jsonStart + 2] = 0x62;
brokenJson[jsonStart + 3] = 0x61;
brokenJson[jsonStart + 4] = 0x64;
brokenJson[jsonStart + 5] = 0x22;
brokenJson[jsonStart + 6] = 0x3a;
brokenJson[jsonStart + 7] = 0x7d;
await writeFile(path.join(root, "broken-json.asar"), brokenJson);
await writeFile(path.join(root, "oversized-header.asar"), makeAsar(headerObject, payload, { headerArea: 64 * 1024 * 1024 + 1 }));

const abnormalPayloadField = Buffer.from(normal);
abnormalPayloadField.writeUInt32LE(0, 8);
await writeFile(path.join(root, "abnormal-payload-field.asar"), abnormalPayloadField);

const unsafeHeader = { files: { "../escape.txt": { size: 0, offset: "0" }, "safe.txt": { size: 0, offset: "0" } } };
await writeFile(path.join(root, "unsafe-path.asar"), makeAsar(unsafeHeader, Buffer.alloc(0)));

const jsonLength = Buffer.byteLength(JSON.stringify(headerObject));
const headerArea = 8 + jsonLength + ((4 - (jsonLength % 4)) % 4);
console.log(JSON.stringify({ root, normalBytes: normal.length, jsonLength, headerArea, payloadBytes: payload.length }));
