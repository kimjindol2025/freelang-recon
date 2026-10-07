# ASAR v1 parser

Phase 3 reads an ASAR header and emits ASAR facts as Evidence v1 envelopes.
Parsing, tree walking, path policy, bounds checks, and evidence construction are
implemented in FreeLang. `scripts/native-bytes.mjs` only reads a bounded byte
range or calculates SHA-256 for that range; file bodies are never extracted to
disk or passed through FreeLang for hashing.

## Supported structure

The parser supports the four little-endian `uint32` prefix fields used by this
project's ASAR v1 contract:

1. marker `4`
2. header area size
3. payload size
4. JSON string length

The JSON begins at byte 16. The payload begins at `8 + header area size`.
In the official `@electron/asar` 4.3.1 output verified here, field `[2]` is
`[1] - 4` (`1536 = 1540 - 4` in the first sample). Field `[2]` is retained as
an observed value and a mismatch is recorded in `asar.header.limitations`; it
does not independently reject an otherwise bounded header.
Entries are read from the `files` tree. File entries use `size` and string
`offset`; directories use `files`; links use `link`; `unpacked` entries are
reported but not read from the archive.

## Evidence kinds

- `asar.header` — observed header area size, JSON length, payload size, and
  entry count.
- `asar.entry` — observed path, entry kind (`file`, `dir`, or `link`), size,
  payload-relative offset, and SHA-256 when the file range is readable.
- `asar.integrity` — observed declared SHA-256, computed SHA-256, and match
  result. Missing declarations are `unknown`, not silently skipped.

Every public result carries an Evidence v1 envelope. Unreadable, unsafe, or
unavailable facts use `confidence: "unknown"`, `value: null`, and a reason in
`limitations`.

## Safety and limits

- `..`, absolute paths, empty path segments, and invalid ranges are rejected;
  no filesystem lookup is attempted for an unsafe entry.
- Header areas larger than 64 MiB, truncated prefixes/headers/payloads, invalid
  JSON, and unsupported integrity algorithms become error evidence rather than
  uncaught runtime failures.
- The parser does not extract files, execute archive contents, analyze JS, or
  expose MCP tools.
- Offsets in evidence are payload-relative, matching ASAR entry metadata.
- `unpacked` entries require a separate file and therefore receive unknown
  evidence for content hashes.

## Fixture validation

The official `@electron/asar` 4.3.1 package was installed in a temporary
directory and used to generate `tests/fixtures/official-electron.asar`.
The parser and independent Buffer inspection both report prefix
`[4, 1808, 1804, 1797]`, JSON length `1797`, and payload offset `1816`.
The official CLI `list` output contains the same seven entry paths as the
parser. A direct payload-range SHA-256 for `normal.asar` also matches the
parser's `asar.entry` evidence.

The tests still use a minimal writer in `scripts/create-asar-fixtures.mjs` for
normal, mutated, truncated, invalid-JSON, oversized-header, unsafe-path, and
abnormal-field cases. Its output was independently checked with Node Buffer
reads: the normal fallback reports prefix `[4, 564, 560, 555]`, JSON length
`555`, header area `564`, payload offset `572`, and available payload size `12`.
