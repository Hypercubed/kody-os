#!/usr/bin/env bash
# Start the kody-os mock dev server reading the LOCAL catalog.
# Usage: ./scripts/dev-local-catalog.sh
#   Serves catalog/ on http://127.0.0.1:8901 and starts
#   `kody dev --target mock` with KODY_CATALOG_BASE pointing at it,
#   so the App Catalog in the mock reads your local catalog (not GitHub).
#   Both servers run detached; stop them with pkill or by rebooting.
#   This is a dev-only override — the repo's App Catalog still declares
#   the GitHub base, which is the production behavior.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CATALOG_DIR="$REPO_ROOT/catalog"
PKG_DIR="$REPO_ROOT/pkg"
CATALOG_PORT=8901
MOCK_PORT=4302
CATALOG_LOG="/tmp/kody-catalog-local.log"
MOCK_LOG="/tmp/kody-mock-local.log"

# Stop any previous instances (bracket trick: pkill must not match this script).
pkill -f '[k]ody dev --target mock' 2>/dev/null || true
pkill -f '[h]ttp.server 8901' 2>/dev/null || true
sleep 2

# 1. Serve the local catalog over HTTP.
cd "$CATALOG_DIR"
setsid nohup python3 -m http.server "$CATALOG_PORT" --bind 127.0.0.1 > "$CATALOG_LOG" 2>&1 < /dev/null &
sleep 2

# 2. Start the mock server with the local-catalog override.
cd "$PKG_DIR"
export NO_PROXY='*' no_proxy='*'
export KODY_CATALOG_BASE="http://127.0.0.1:${CATALOG_PORT}/"
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
setsid nohup kody dev --target mock > "$MOCK_LOG" 2>&1 < /dev/null &
sleep 8

# 3. Verify both are up.
echo "catalog: $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${CATALOG_PORT}/catalog.json" || echo down)  http://127.0.0.1:${CATALOG_PORT}/catalog.json"
echo "mock:    $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${MOCK_PORT}/" || echo down)  http://127.0.0.1:${MOCK_PORT}/"
echo "logs: $CATALOG_LOG  $MOCK_LOG"
