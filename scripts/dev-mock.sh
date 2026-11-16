#!/usr/bin/env bash
# Start the kody-os mock dev server, with the LOCAL catalog available.
# Usage: ./scripts/dev-mock.sh [--lan] [--no-catalog] [--no-stub]
#         ./scripts/dev-mock.sh stop
#         ./scripts/dev-mock.sh --help
#   Serves catalog/ on http://127.0.0.1:8901 (unless --no-catalog) and
#   starts `kody dev --target mock --allow-private-network` so the
#   mock's workerd can fetch the loopback catalog. KODY_CATALOG_BASE
#   is still exported (harmless; it does not reach package code in the
#   mock — the generated workerd config binds only KODY_RUN_SECRET).
#   The override the mock actually reads is the stored dev base
#   (kody-os.dev.catalogBase), and this script manages it while the
#   mock is stopped: default sets it to http://127.0.0.1:8901/,
#   --no-catalog clears it back to the Store's declared GitHub base.
#   Installing
#   from GitHub instead ("base":"https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/")
#   needs no flag.
#   With --lan, `kody dev` listens on 0.0.0.0:4302 directly (CLI flag
#   --host), so devices on the trusted local network can open the preview.
#   LAN is opt-in only: the dev server is plain HTTP with no TLS, so never
#   start it with --lan on public Wi-Fi or beyond the local network.
#   With --no-catalog, the catalog server is not started and the stored
#   dev base is cleared: the mock reads the Store's declared GitHub
#   base. With
#   --no-stub, KODY_DEV_STUB_RUNTIME is left unset and 3.35.x boots
#   its default local-Kody upstream (app mounted at
#   /@<user>/packages/<kodyId> instead of bare /apps links).
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
  ./scripts/dev-mock.sh                    # catalog + kody dev, no LAN
  ./scripts/dev-mock.sh --lan              # ... + kody dev on 0.0.0.0:4302
  ./scripts/dev-mock.sh --no-catalog       # kody dev only (declared GitHub base)
  ./scripts/dev-mock.sh --no-stub          # ... without KODY_DEV_STUB_RUNTIME=1
  ./scripts/dev-mock.sh stop               # stop both, print what stopped
  ./scripts/dev-mock.sh --help             # print this usage, exit 0

With --lan, `kody dev` listens on 0.0.0.0:4302 directly (plain HTTP,
no TLS). It starts only with --lan. Trusted LAN only: never on public
Wi-Fi, never beyond the local network.
EOF
}

LAN=0
NO_CATALOG=0
NO_STUB=0
MODE="start"
while [ $# -gt 0 ]; do
  case "$1" in
    --lan) LAN=1 ;;
    --no-catalog) NO_CATALOG=1 ;;
    --no-stub) NO_STUB=1 ;;
    stop) MODE="stop" ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
  shift
done

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

# 1. Point the stopped mock at the right catalog source before it boots:
# default pins the stored dev base at the local catalog, --no-catalog
# clears it so the mock falls back to the Store's declared GitHub base.
# Must run while kody dev is stopped: the mock reads its store once at
# startup, so a write while running would not show until restart.
cd "$PKG_DIR"
export NO_PROXY='*' no_proxy='*'
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy || true
DEV_BASE_LOG="$(mktemp /tmp/kody-dev-base.XXXXXX.log)"
if [ "$NO_CATALOG" = "0" ]; then
  if ! kody execute --target mock --allow-private-network --file scripts/catalog.ts --params '{"op":"dev-base","base":"http://127.0.0.1:8901/"}' > "$DEV_BASE_LOG" 2>&1; then
    echo "warning: could not set stored dev catalog base; see $DEV_BASE_LOG" >&2
  fi
else
  if ! kody execute --target mock --allow-private-network --file scripts/catalog.ts --params '{"op":"dev-base"}' > "$DEV_BASE_LOG" 2>&1; then
    echo "warning: could not clear stored dev catalog base; see $DEV_BASE_LOG" >&2
  fi
fi

# 2. Serve the local catalog over HTTP (unless opted out).
if [ "$NO_CATALOG" = "0" ]; then
  cd "$CATALOG_DIR"
  setsid nohup python3 -m http.server "$CATALOG_PORT" --bind 127.0.0.1 > "$CATALOG_LOG" 2>&1 < /dev/null &
  sleep 2
fi

# 3. Start the mock server. With --lan it listens on 0.0.0.0 directly;
# otherwise loopback only (CLI default).
cd "$PKG_DIR"
export NO_PROXY='*' no_proxy='*'
export KODY_CATALOG_BASE="http://127.0.0.1:${CATALOG_PORT}/"
# 3.35.x boots a local-Kody upstream by default, mounting the app at
# /@<user>/packages/<kodyId>. KODY_DEV_STUB_RUNTIME=1 skips that and
# restores direct-workerd behavior (empty appBasePath, bare /apps links).
if [ "$NO_STUB" = "0" ]; then
  export KODY_DEV_STUB_RUNTIME="1"
else
  unset KODY_DEV_STUB_RUNTIME || true
fi
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy || true
HOST_ARGS=()
if [ "$LAN" = "1" ]; then
  HOST_ARGS=(--host 0.0.0.0)
fi
setsid nohup kody dev --target mock --allow-private-network "${HOST_ARGS[@]}" > "$MOCK_LOG" 2>&1 < /dev/null &
sleep 8

# 4. Verify and report.
if [ "$NO_CATALOG" = "0" ]; then
  echo "catalog: $(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${CATALOG_PORT}/catalog.json" || echo down)  http://127.0.0.1:${CATALOG_PORT}/catalog.json"
else
  echo "catalog: off (--no-catalog; mock reads the declared GitHub base)"
fi
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
