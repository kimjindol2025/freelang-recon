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

if [[ "${1:-}" == "--portable" && "${RECON_PORTABLE_ACTIVE:-0}" != "1" ]]; then
  copy_root="$(mktemp -d)"
  trap 'rm -rf "$copy_root"' EXIT
  cp -a "$ROOT" "$copy_root/repo"
  RECON_ROOT="$copy_root/repo" RECON_PORTABLE_ACTIVE=1 FREELANG_V11_ROOT="$V11" \
    bash "$copy_root/repo/scripts/test-all.sh"
fi

echo "TEST-ALL PASS"
