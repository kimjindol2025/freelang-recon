#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
V11="${FREELANG_V11_ROOT:-}"
AFJ_ROOT="${AFJ_DB_ROOT:-}"
if [[ -z "$V11" || ! -f "$V11/bootstrap.js" ]]; then
  echo "FREELANG_V11_ROOT must point to a FreeLang v11 runtime" >&2
  exit 2
fi
if [[ -z "$AFJ_ROOT" || ! -f "$AFJ_ROOT/tests/tcp-daemon.fls" ]]; then
  echo "AFJ_DB_ROOT must point to the AFJ DB95 checkout" >&2
  exit 2
fi

export RECON_ROOT="$ROOT"
export FREELANG_V11_ROOT="$V11"
export AFJ_DB_ROOT="$AFJ_ROOT"
node "$ROOT/scripts/test-phase4c.mjs"
echo "PHASE4C_ADAPTER=PASS"
