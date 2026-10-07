# Evidence v1

Evidence v1 is the common envelope for every FreeLang Recon analysis result.
The envelope keeps an observation, its source location, confidence, and known
limits together so later search, tracing, and MCP layers can consume one shape.

## Schema

```json
{
  "schema": "evidence/v1",
  "evidence_id": "<first 16 hex characters of SHA-256>",
  "kind": "asar.entry",
  "artifact": { "path": "app.asar", "sha256": "..." },
  "location": { "entry": "package.json", "offset": 0, "length": 123 },
  "value": { "name": "example" },
  "confidence": "observed",
  "limitations": []
}
```

All top-level fields are required. `artifact.path`, `artifact.sha256`, and
`location.entry` are strings. `location.offset` and `location.length` are
numbers or `null`. `value` is any JSON value or `null`. `limitations` is an
array containing only strings.

## Confidence rules

- `observed`: the value was read directly from the artifact.
- `inferred`: the value is an inference; `limitations` must contain at least
  one reason or qualification.
- `unknown`: the value is unavailable; `value` must be `null` and
  `limitations` must contain at least one reason.

## Canonical serialization and ID

`canonical_serialize` recursively serializes JSON values with object keys in
alphabetical order, no whitespace, JSON string escaping, and stable array
order. The `evidence_id` field is excluded before serialization. The ID is the
first 16 hexadecimal characters of SHA-256 over that canonical string.

The Node adapter only performs this digest operation. Envelope construction,
validation, and canonicalization are implemented in FreeLang.

## Example

```json
{
  "artifact": { "path": "app.asar", "sha256": "abc..." },
  "confidence": "inferred",
  "evidence_id": "0123456789abcdef",
  "kind": "package.manifest",
  "limitations": ["minified bundle; source map unavailable"],
  "location": { "entry": "package.json", "length": null, "offset": null },
  "schema": "evidence/v1",
  "value": { "main": "dist/main.js" }
}
```
