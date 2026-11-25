#!/usr/bin/env bash
# Tamurt Jobs — installs a release on the server and switches to it, with automatic return
# to the previous release if the new one does not answer.
#   deploy.sh <archive.tar.gz> <release-id>
# The archive is the content of .next/standalone (with public/ and .next/static), built by
# scripts/package-standalone.sh. Nothing is deleted except releases beyond KEEP_RELEASES.
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/tamurt-jobs}"
RESTART_CMD="${RESTART_CMD:-sudo /usr/bin/systemctl restart tamurt-jobs}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

archive="${1:-}"
id="${2:-}"
[ -f "$archive" ] || { echo "deploy: archive not found: $archive" >&2; exit 2; }
[[ "$id" =~ ^[0-9A-Za-z._-]+$ ]] || { echo "deploy: invalid release id: $id" >&2; exit 2; }

release="$APP_DIR/releases/$id"
mkdir -p "$APP_DIR/releases" "$APP_DIR/shared/_next/static"
[ ! -e "$release" ] || { echo "deploy: release $id already exists" >&2; exit 2; }

switch_to() {
  ln -sfn "$1" "$APP_DIR/current.new"
  mv -Tf "$APP_DIR/current.new" "$APP_DIR/current"
}

healthy() {
  local body
  for _ in $(seq 1 30); do
    if body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2> /dev/null)" && grep -q '"database":"ok"' <<< "$body"; then
      echo "deploy: health $body"
      return 0
    fi
    sleep 2
  done
  return 1
}

mkdir "$release"
tar -xzf "$archive" -C "$release"
[ -f "$release/server.js" ] || { echo "deploy: server.js missing in the archive" >&2; rm -rf -- "$release"; exit 2; }
if compgen -G "$release/.env*" > /dev/null; then
  echo "deploy: the archive contains .env files: refused (secrets belong in /etc/tamurt-jobs/env)" >&2
  rm -rf -- "$release"
  exit 2
fi

# Build files have unique names: they are kept from one release to the next, so that a page
# opened before the switch can still load its scripts. Nginx serves them from shared/.
cp -a "$release/.next/static/." "$APP_DIR/shared/_next/static/"

previous="$(readlink "$APP_DIR/current" 2> /dev/null || true)"
switch_to "$release"
$RESTART_CMD

if ! healthy; then
  echo "deploy: the new release does not answer; back to ${previous:-nothing}" >&2
  if [ -n "$previous" ]; then
    switch_to "$previous"
    $RESTART_CMD
    healthy || echo "deploy: WARNING the previous release does not answer either" >&2
  fi
  # Out of releases/, so that rollback.sh never picks it; kept for diagnosis.
  mkdir -p "$APP_DIR/failed"
  mv -- "$release" "$APP_DIR/failed/$id"
  echo "deploy: failed release kept in $APP_DIR/failed/$id" >&2
  exit 1
fi

# Keep the last KEEP_RELEASES releases (never the current one).
current="$(readlink -f "$APP_DIR/current")"
mapfile -t old < <(find "$APP_DIR/releases" -mindepth 1 -maxdepth 1 -type d | sort | head -n "-$KEEP_RELEASES")
for dir in "${old[@]}"; do
  [ "$(readlink -f "$dir")" = "$current" ] || rm -rf -- "$dir"
done
echo "deploy: release $id is live"
