#!/usr/bin/env bash
# Tamurt Jobs — builds the self-contained server for our own hosting (Iglao) and packs it.
#   scripts/package-standalone.sh [output.tar.gz]
# The NEXT_PUBLIC_* variables and APP_ENV must be set in the environment: they are written
# into the build. No secret is needed to build, and none is packed (.env files are refused).
set -euo pipefail
cd "$(dirname "$0")/.."

out="${1:-tamurt-jobs-release.tar.gz}"
: "${APP_ENV:?APP_ENV is required (preprod or production)}"
: "${NEXT_PUBLIC_SITE_URL:?NEXT_PUBLIC_SITE_URL is required}"
: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"
: "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:?NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required}"

NEXT_OUTPUT=standalone npx next build
standalone=.next/standalone
[ -f "$standalone/server.js" ] || { echo "package: no standalone server.js" >&2; exit 1; }

# server.js serves public/ and .next/static/ when they sit next to it (Nginx serves the latter too).
cp -r public "$standalone/"
mkdir -p "$standalone/.next"
cp -r .next/static "$standalone/.next/"

# Never ship local secrets.
find "$standalone" -maxdepth 1 -name '.env*' -print -delete

tar -czf "$out" -C "$standalone" .
echo "package: $out ($(du -h "$out" | cut -f1))"
