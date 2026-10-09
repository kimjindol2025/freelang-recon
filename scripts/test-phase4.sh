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

db_dir="$(mktemp -d "${TMPDIR:-/tmp}/freelang-recon-phase4.XXXXXX")"
trap 'rm -rf "$db_dir"' EXIT
export RECON_ROOT="$ROOT"
export AFJ_DB_CLI="$AFJ_CLI"
export AFJ_DB_DIR="$db_dir"
digest_file="$db_dir/evidence-digest.txt"
export AFJ_EVIDENCE_DIGEST_FILE="$digest_file"
node "$V11/bootstrap.js" check tests/phase4-persistence.fl
node "$V11/bootstrap.js" run tests/phase4-persistence.fl
test -s "$digest_file"
export AFJ_EVIDENCE_DIGEST="$(sed -n '1p' "$digest_file")"
node "$V11/bootstrap.js" check tests/phase4-recovery.fl
node "$V11/bootstrap.js" run tests/phase4-recovery.fl
echo "PHASE4_PERSISTENCE=PASS"
