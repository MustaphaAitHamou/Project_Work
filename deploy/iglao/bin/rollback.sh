#!/usr/bin/env bash
# Tamurt Jobs — returns to a previous release in a few seconds.
#   rollback.sh            the release before the current one
#   rollback.sh <id>       a given release (see: ls /srv/tamurt-jobs/releases)
# The database is not touched: migrations are additive, the previous code keeps working.
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/tamurt-jobs}"
RESTART_CMD="${RESTART_CMD:-sudo /usr/bin/systemctl restart tamurt-jobs}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"

current="$(basename "$(readlink -f "$APP_DIR/current")")"
if [ $# -ge 1 ]; then
  target="$1"
else
  target="$(find "$APP_DIR/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | grep -B1 -x -- "$current" | head -1 || true)"
fi
if [ -z "$target" ] || [ "$target" = "$current" ] || [ ! -d "$APP_DIR/releases/$target" ]; then
  echo "rollback: no release to return to (current: $current)" >&2
  exit 1
fi

switch_to() {
  ln -sfn "$APP_DIR/releases/$1" "$APP_DIR/current.new"
  mv -Tf "$APP_DIR/current.new" "$APP_DIR/current"
  $RESTART_CMD
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 5 "$HEALTH_URL" 2> /dev/null | grep -q '"database":"ok"'; then return 0; fi
    sleep 2
  done
  return 1
}

if switch_to "$target"; then
  echo "rollback: $current -> $target, live"
  exit 0
fi
echo "rollback: $target does not answer; back to $current" >&2
switch_to "$current" || echo "rollback: WARNING $current does not answer either" >&2
exit 1
