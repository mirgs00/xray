#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  XRAY TEST EXECUTION DASHBOARD  ·  Linux Launcher
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e " ${GREEN}[OK]${NC} $1"; }
warn()  { echo -e " ${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e " ${RED}[ERROR]${NC} $1"; }

cleanup() {
  echo
  echo "Shutting down services..."
  [ -n "${PROXY_PID:-}" ] && kill "$PROXY_PID" 2>/dev/null && info "Proxy server stopped"
  [ -n "${FILE_PID:-}" ] && kill "$FILE_PID" 2>/dev/null && info "File server stopped"
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "================================================"
echo "   XRAY TEST EXECUTION DASHBOARD LAUNCHER"
echo "================================================"
echo

if ! command -v node &>/dev/null; then
  err "Node.js not found. Install from https://nodejs.org"
  exit 1
fi
info "Node.js found: $(node --version)"

if [ ! -f "$DIR/xray-proxy-server.js" ]; then
  err "xray-proxy-server.js not found in $DIR"
  exit 1
fi
info "Proxy server file found"

DASHBOARD_FILE=""
for f in "$DIR"/xray-test-dashboard-v*.html; do
  [ -f "$f" ] && DASHBOARD_FILE="$(basename "$f")"
done
if [ -z "$DASHBOARD_FILE" ]; then
  [ -f "$DIR/xray-test-dashboard.html" ] && DASHBOARD_FILE="xray-test-dashboard.html"
fi
if [ -z "$DASHBOARD_FILE" ]; then
  warn "No dashboard HTML file found; will serve directory listing"
else
  info "Latest dashboard detected: $DASHBOARD_FILE"
fi

echo
info "Cleaning up ports 3001 and 8080..."
fuser -k 3001/tcp 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true
sleep 1
info "Ports cleaned"
echo

info "Starting XRAY proxy server (port 3001)..."
node xray-proxy-server.js &
PROXY_PID=$!

if command -v curl &>/dev/null; then
  info "Waiting for proxy readiness..."
  for i in $(seq 1 15); do
    if curl -sf http://localhost:3001/health >/dev/null 2>&1; then
      info "Proxy server is responsive"
      break
    fi
    sleep 1
  done
  if ! curl -sf http://localhost:3001/health >/dev/null 2>&1; then
    warn "Proxy health check timed out — continuing anyway"
  fi
else
  warn "curl not found — skipping proxy health check"
  sleep 2
fi
echo

info "Starting file server on port 8080..."
FILE_PID=""
if command -v python3 &>/dev/null; then
  info "Using Python http.server"
  python3 -m http.server 8080 &
  FILE_PID=$!
elif command -v python &>/dev/null; then
  info "Using Python http.server"
  python -m http.server 8080 &
  FILE_PID=$!
elif command -v npx &>/dev/null; then
  info "Using npx http-server"
  npx http-server -p 8080 --cors &
  FILE_PID=$!
else
  err "Neither Python nor npx is available!"
  err "Install Python or run: npm install -g http-server"
  exit 1
fi

sleep 2
info "File server started"
echo

URL="http://localhost:8080/"
[ -n "$DASHBOARD_FILE" ] && URL="http://localhost:8080/${DASHBOARD_FILE}?proxy=local"

if command -v xdg-open &>/dev/null; then
  info "Opening dashboard..."
  xdg-open "$URL" 2>/dev/null || true
elif command -v sensible-browser &>/dev/null; then
  sensible-browser "$URL" 2>/dev/null || true
fi

echo "================================================"
echo "   XRAY DASHBOARD IS RUNNING"
echo
echo "   Dashboard: $URL"
echo "   Proxy API: http://localhost:3001/health"
echo
echo "   To stop:   Ctrl+C"
echo "================================================"
echo

while true; do sleep 5; done
