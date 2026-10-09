#!/usr/bin/env bash
set -euo pipefail

ROOT="${RECON_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
V11="${FREELANG_V11_ROOT:-}"
if [[ -z "$V11" || ! -f "$V11/bootstrap.js" ]]; then
  echo "FREELANG_V11_ROOT must point to a FreeLang v11 runtime" >&2
  exit 2
fi

cd "$ROOT"
export RECON_ROOT="$ROOT"
for file in tests/phase1-capabilities.fl tests/phase2-evidence.fl tests/phase3-asar.fl tests/phase31-real-asar.fl; do
  node "$V11/bootstrap.js" check "$file"
  node "$V11/bootstrap.js" run "$file"
done

inventory_json="$(RECON_INVENTORY_TARGET="$ROOT/tests/fixtures" \
  RECON_INVENTORY_ALLOWED_ROOT="$ROOT" \
  node "$V11/bootstrap.js" run src/local-inventory.fl)"
node -e 'const d=JSON.parse(process.argv[1]); if (d.execution !== "not-executed" || !d.manifest || !d.digest || d.manifest.target !== process.argv[2]) process.exit(1); console.log("LOCAL_INVENTORY_ALLOWLIST=PASS")' "$inventory_json" "$ROOT/tests/fixtures"

denied_json="$(RECON_INVENTORY_TARGET="/tmp" \
  RECON_INVENTORY_ALLOWED_ROOT="$ROOT" \
  node "$V11/bootstrap.js" run src/local-inventory.fl)"
node -e 'const d=JSON.parse(process.argv[1]); if (d.manifest !== null || !d.unknowns.some(item => item.includes("outside allowlist"))) process.exit(1); console.log("LOCAL_INVENTORY_DENY=PASS")' "$denied_json"

range_error="$(node scripts/native-bytes.mjs read_bytes "$ROOT/tests/fixtures/normal.asar" 0 67108865)"
node -e 'const d=JSON.parse(process.argv[1]); if (d.ok !== false || d.error !== "range exceeds 64 MiB limit") process.exit(1); console.log("NATIVE_RANGE_LIMIT=PASS")' "$range_error"

if [[ "${1:-}" == "--portable" && "${RECON_PORTABLE_ACTIVE:-0}" != "1" ]]; then
  copy_root="$(mktemp -d)"
  trap 'rm -rf "$copy_root"' EXIT
  cp -a "$ROOT" "$copy_root/repo"
  RECON_ROOT="$copy_root/repo" RECON_PORTABLE_ACTIVE=1 FREELANG_V11_ROOT="$V11" \
    bash "$copy_root/repo/scripts/test-all.sh"
fi

echo "TEST-ALL PASS"
