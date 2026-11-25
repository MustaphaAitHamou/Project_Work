#!/usr/bin/env bash
# Tamurt Jobs — runs one scheduled job on the local server, as Vercel Cron does on Vercel.
# Installed by /etc/cron.d/tamurt-jobs. Usage: run-cron.sh maintenance|emails|alerts
set -euo pipefail

job="${1:-}"
case "$job" in
  maintenance | emails | alerts) ;;
  *) echo "usage: $0 maintenance|emails|alerts" >&2; exit 2 ;;
esac

ENV_FILE="${ENV_FILE:-/etc/tamurt-jobs/env}"
APP_URL="${APP_URL:-http://127.0.0.1:3000}"
STATE_DIR="${STATE_DIR:-/srv/tamurt-jobs/shared/cron}"
log() { if command -v logger > /dev/null; then logger -t tamurt-jobs-cron "$*"; else echo "tamurt-jobs-cron: $*"; fi; }

secret="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
if [ -z "$secret" ]; then log "$job: CRON_SECRET missing in $ENV_FILE"; exit 1; fi

mkdir -p "$STATE_DIR"
# One run at a time per job: a slow run is never doubled by the next one.
exec 9> "$STATE_DIR/cron-$job.lock"
if ! flock -n 9; then log "$job: previous run still in progress, skipped"; exit 0; fi

out="$STATE_DIR/cron-$job.out"
# The secret goes through curl's standard input, not its command line (visible to other users).
code="$(printf 'header = "Authorization: Bearer %s"\n' "$secret" |
  curl --config - -sS -o "$out" -w '%{http_code}' --max-time 300 "$APP_URL/api/cron/$job" || echo 000)"
log "$job: HTTP $code $(head -c 300 "$out" 2> /dev/null | tr -d '\n')"
[ "$code" = "200" ]
