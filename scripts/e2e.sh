#!/usr/bin/env bash
# Browser tests against a production build and a local Supabase stack (which must already be running:
# `supabase start`). Usage: scripts/e2e.sh [playwright args]
set -euo pipefail
cd "$(dirname "$0")/.."

eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

echo "==> seed"
node tests/e2e/seed.mjs
echo "==> next build"
npm run --silent build
echo "==> playwright"
npx playwright test "$@"
