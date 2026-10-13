#!/usr/bin/env bash
# Print one section of a project doc instead of the whole file (the plan alone is ~24k tokens).
#   scripts/doc.sh <doc> --list              outline: headings with line numbers
#   scripts/doc.sh <doc> <heading-pattern>   the matching section (case-insensitive regex on the heading line)
# <doc> is an alias or a path:  plan | cheat | db | mig | perf | known | state | arch
# Examples:
#   scripts/doc.sh plan "Phase 6"            scripts/doc.sh cheat "Migrations"
#   scripts/doc.sh db "5. RLS"               scripts/doc.sh known "KI-010"
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-}" in
  plan)  f=docs/implementation-plan.md ;;
  cheat) f=docs/IMPLEMENTATION_CHEATSHEET.md ;;
  db)    f=docs/DATABASE.md ;;
  mig)   f=docs/MIGRATIONS.md ;;
  perf)  f=docs/QUERY_PERFORMANCE_BACKLOG.md ;;
  known) f=docs/KNOWN_ISSUES.md ;;
  state) f=docs/PROJECT_STATE.md ;;
  arch)  f=ARCHITECTURE.md ;;
  "")    sed -n '2,10p' "$0"; exit 2 ;;
  *)     f=$1 ;;
esac
[ -f "$f" ] || { echo "no such doc: $f" >&2; exit 1; }
pat=${2:---list}

if [ "$pat" = "--list" ]; then
  # headings outside code fences, with line numbers
  awk '/^```/{c=!c} !c && /^#+ /{printf "%5d  %s\n", NR, $0}' "$f"
  exit 0
fi

# Rows of a table (for example KI-010 in KNOWN_ISSUES) have no heading: fall back to matching lines.
if ! awk -v p="$pat" 'BEGIN{IGNORECASE=1} /^```/{c=!c} !c && /^#+ / && tolower($0) ~ tolower(p){f=1} END{exit !f}' "$f"; then
  grep -n -i -- "$pat" "$f" | cut -c1-1200 || { echo "no section or line matches: $pat" >&2; exit 1; }
  exit 0
fi

awk -v p="$pat" '
  /^```/ { c = !c }
  !c && /^#+ / {
    match($0, /^#+/); lvl = RLENGTH
    if (on && lvl <= start) exit
    if (!on && tolower($0) ~ tolower(p)) { on = 1; start = lvl }
  }
  on { print }
' "$f"
