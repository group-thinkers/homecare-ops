#!/usr/bin/env bash
# Guards the append-only migration history (INV-4). Production applies supabase/migrations on merge, so a duplicate number or an
# edited migration is an incident. Checks:
#   1. every .sql file is named NNNNN_snake_case.sql
#   2. numbers are unique and gapless from 00001
#   3. with --base <ref>: no migration that exists on the base was modified, deleted or renamed,
#      unless its file name is listed in the allow file (add it deliberately, with a reason, in the same PR)
#
#   scripts/check-migrations.sh [--dir supabase/migrations] [--base origin/main] [--allow supabase/migration-edits.allow]
set -euo pipefail

dir=supabase/migrations; base=""; allow=supabase/migration-edits.allow
while [ $# -gt 0 ]; do
  case "$1" in
    --dir) dir=$2; shift 2 ;;
    --base) base=$2; shift 2 ;;
    --allow) allow=$2; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

fail=0
err() { echo "migration check: $*" >&2; fail=1; }

shopt -s nullglob
files=("$dir"/*.sql)
[ ${#files[@]} -gt 0 ] || { echo "migration check: no migrations in $dir" >&2; exit 1; }

expected=1
for f in $(printf '%s\n' "${files[@]}" | sort); do
  name=$(basename "$f")
  if ! [[ "$name" =~ ^[0-9]{5}_[a-z0-9_]+\.sql$ ]]; then err "bad file name '$name' (want 00018_snake_case.sql)"; continue; fi
  n=$((10#${name%%_*}))
  if [ "$n" -lt "$expected" ]; then err "duplicate migration number ${name%%_*} ($name). Rebase on main and renumber your unmerged file."
  elif [ "$n" -gt "$expected" ]; then err "gap before $name: expected $(printf '%05d' "$expected") (numbers must be sequential)"; expected=$((n + 1))
  else expected=$((n + 1)); fi
done

if [ -n "$base" ]; then
  allowed=""
  [ -f "$allow" ] && allowed=$(grep -vE '^\s*(#|$)' "$allow" | awk '{print $1}' || true)
  while IFS=$'\t' read -r status path rest; do
    [ -n "${status:-}" ] || continue
    case "$status" in
      A*) continue ;;
      M|D|R*|T|C*)
        name=$(basename "$path")
        [[ "$name" == *.sql ]] || continue
        if echo "$allowed" | grep -qx "$name"; then echo "migration check: edit of $name allowed by $allow" >&2; continue; fi
        err "existing migration $name was changed ($status). Migrations are append-only: fix forward with a new file, or list it in $allow with a reason."
        ;;
    esac
  done < <(git diff --name-status -M "$base"...HEAD -- "$dir")
fi

[ "$fail" = 0 ] && echo "migration check: ok (${#files[@]} migrations)"
exit "$fail"
