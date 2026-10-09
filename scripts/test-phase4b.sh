#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
V11="${FREELANG_V11_ROOT:-}"
AFJ_CLI="${AFJ_DB_CLI:-}"
if [[ -z "$V11" || ! -f "$V11/bootstrap.js" ]]; then
  echo "FREELANG_V11_ROOT must point to a FreeLang v11 runtime" >&2
  exit 2
fi
if [[ -z "$AFJ_CLI" || ! -f "$AFJ_CLI" ]]; then
  echo "AFJ_DB_CLI must point to the AFJ v2 CLI" >&2
  exit 2
fi

export RECON_ROOT="$ROOT"
export AFJ_DB_CLI="$AFJ_CLI"
node "$ROOT/scripts/test-phase4b.mjs"
echo "PHASE4B_FAILURE_CONSISTENCY=PASS_WITH_LIMITATION"
