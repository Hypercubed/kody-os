#!/usr/bin/env bash
# Start the kody-os mock dev server reading the LOCAL catalog.
# Usage: ./scripts/dev-local-catalog.sh [--lan]
#         ./scripts/dev-local-catalog.sh stop
#         ./scripts/dev-local-catalog.sh --help
#   Serves catalog/ on http://127.0.0.1:8901 and starts
#   `kody dev --target mock` with KODY_CATALOG_BASE pointing at it,
#   so the App Catalog in the mock reads your local catalog (not GitHub).
#   With --lan, `kody dev` listens on 0.0.0.0:4302 directly (CLI flag
#   --host), so devices on the trusted local network can open the preview.
#   LAN is opt-in only: the dev server is plain HTTP with no TLS, so never
#   start it with --lan on public Wi-Fi or beyond the local network.
#   All servers run detached; re-running this script is the restart path,
#   `stop` stops both. This is a dev-only override — the repo's App
#   Catalog still declares the GitHub base, which is production behavior.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CATALOG_DIR="$REPO_ROOT/catalog"
PKG_DIR="$REPO_ROOT/pkg"
CATALOG_PORT=8901
MOCK_PORT=4302
CATALOG_LOG="/tmp/kody-catalog-local.log"
MOCK_LOG="/tmp/kody-mock-local.log"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/dev-local-catalog.sh          # catalog + kody dev, no LAN
  ./scripts/dev-local-catalog.sh --lan    # catalog + kody dev on 0.0.0.0:4302
  ./scripts/dev-local-catalog.sh stop     # stop both, print what stopped
  ./scripts/dev-local-catalog.sh --help   # print this usage, exit 0

With --lan, `kody dev` listens on 0.0.0.0:4302 directly (plain HTTP,
no TLS). It starts only with --lan. Trusted LAN only: never on public
Wi-Fi, never beyond the local network.
EOF
}

LAN=0
MODE="start"
if [ $# -eq 0 ]; then
  :
elif [ $# -eq 1 ]; then
  case "$1" in
    --lan) LAN=1 ;;
    stop) MODE="stop" ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
else
  usage >&2
  exit 1
fi

stop_all_quiet() {
  pkill -f '[k]ody dev --target mock' 2>/dev/null || true
  pkill -f '[h]ttp.server 8901' 2>/dev/null || true
}

stop_one() {
  if pkill -f "$1" 2>/dev/null; then
    echo "stopped $2"
  else
    echo "not running: $2"
  fi
}

if [ "$MODE" = "stop" ]; then
  stop_one '[k]ody dev --target mock' "kody dev (mock)"
  stop_one '[h]ttp.server 8901' "catalog server (8901)"
  sleep 2
  exit 0
fi

# Stop any previous instances first (bracket trick: pkill must not match
# this script).
stop_all_quiet
sleep 2

# 1. Serve the local catalog over HTTP.
cd "$CATALOG_DIR"
setsid nohup python3 -m http.server "$CATALOG_PORT" --bind 127.0.0.1 > "$CATALOG_LOG" 2>&1 < /dev/null &
sleep 2

# 2. Start the mock server with the local-catalog override. With --lan it
# listens on 0.0.0.0 directly; otherwise loopback only (CLI default).
cd "$PKG_DIR"
export NO_PROXY='*' no_proxy='*'
export KODY_CATALOG_BASE="http://127.0.0.1:${CATALOG_PORT}/"
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy || true
HOST_ARGS=()
if [ "$LAN" = "1" ]; then
  HOST_ARGS=(--host 0.0.0.0)
fi
setsid nohup kody dev --target mock "${HOST_ARGS[@]}" > "$MOCK_LOG" 2>&1 < /dev/null &
sleep 8

# 3. Verify and report.
echo "catalog: $(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${CATALOG_PORT}/catalog.json" || echo down)  http://127.0.0.1:${CATALOG_PORT}/catalog.json"
echo "mock:    $(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${MOCK_PORT}/" || echo down)  http://127.0.0.1:${MOCK_PORT}/"
if [ "$LAN" = "1" ]; then
  LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  LOOP_CODE="$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${MOCK_PORT}/__kody/dev/status" || echo down)"
  if [ -n "${LAN_IP:-}" ]; then
    LAN_CODE="$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' --max-time 5 "http://${LAN_IP}:${MOCK_PORT}/__kody/dev/status" || echo down)"
    echo "lan:     ${LOOP_CODE}/${LAN_CODE}  http://${LAN_IP}:${MOCK_PORT}/"
  else
    echo "lan:     ${LOOP_CODE}  http://127.0.0.1:${MOCK_PORT}/"
    echo "warning: no LAN IP detected (hostname -I empty); server still listens on 0.0.0.0:${MOCK_PORT}" >&2
  fi
  echo "logs: $CATALOG_LOG  $MOCK_LOG"
else
  echo "lan: off"
  echo "logs: $CATALOG_LOG  $MOCK_LOG"
fi
