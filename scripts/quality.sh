#!/usr/bin/env bash
# One entry point for every check, so CI runs exactly what you run locally.
#   scripts/quality.sh [lint|typecheck|test|build|audit|full]
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n==> %s\n' "$*"; }

lint()      { step "eslint";     npm run --silent lint; }
typecheck() { step "tsc";        npx tsc --noEmit; }
test_()     { step "vitest";     npm test --silent; }

build() {
  step "next build"
  # Placeholders keep the build independent of real secrets; nothing talks to Supabase while building.
  NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}" \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-placeholder-key}" \
  SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-placeholder-key}" \
    npm run --silent build
}

# Production dependencies only. AUDIT_LEVEL=high makes this a hard gate (nightly); pull requests run it advisory.
audit() { step "npm audit (${AUDIT_LEVEL:-high}+)"; npm audit --omit=dev --audit-level="${AUDIT_LEVEL:-high}"; }

case "${1:-full}" in
  lint)      lint ;;
  typecheck) typecheck ;;
  test)      test_ ;;
  build)     build ;;
  audit)     audit ;;
  full)      lint; typecheck; test_; build ;;
  *) echo "usage: $0 [lint|typecheck|test|build|audit|full]" >&2; exit 2 ;;
esac
