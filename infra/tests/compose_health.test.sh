#!/usr/bin/env bash
set -euo pipefail

FILE="docker-compose.yml"
if [[ ! -f "$FILE" ]]; then
  echo "missing docker-compose.yml" >&2
  exit 1
fi

check_health() {
  local svc="$1"
  if awk -v svc="$svc" '
    $1==svc":" {found=1}
    found && /healthcheck:/ {ok=1}
    found && /^  [^ ]/ && $1!=svc":" {exit}
    END {if (found && ok) exit 0; else exit 1}
  ' "$FILE"; then
    return 0
  else
    echo "missing healthcheck for $svc" >&2
    return 1
  fi
}

missing=0
for service in postgres redis backend geth; do
  if ! check_health "$service"; then
    missing=1
  fi
done

if ! grep -q "profiles" "$FILE"; then
  echo "profiles section missing" >&2
  missing=1
fi

exit $missing
