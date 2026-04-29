#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT_DIR}/.tmp-share"
mkdir -p "${LOG_DIR}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed. Install it first: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
fi

echo "Starting frontend tunnel (:3000)..."
cloudflared tunnel --url http://localhost:3000 > "${LOG_DIR}/frontend-tunnel.log" 2>&1 &
FRONT_TUNNEL_PID=$!

echo "Starting backend tunnel (:4000)..."
cloudflared tunnel --url http://localhost:4000 > "${LOG_DIR}/backend-tunnel.log" 2>&1 &
BACK_TUNNEL_PID=$!

cleanup() {
  echo ""
  echo "Stopping tunnels..."
  kill "${FRONT_TUNNEL_PID}" 2>/dev/null || true
  kill "${BACK_TUNNEL_PID}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "Waiting for Cloudflare tunnel URLs..."
FRONT_URL=""
BACK_URL=""
extract_tunnel_url() {
  local log_file="$1"
  awk 'match($0,/https:\/\/[a-z0-9-]+\.trycloudflare\.com/){print substr($0,RSTART,RLENGTH); exit}' "$log_file"
}

for _ in {1..30}; do
  FRONT_URL=$(extract_tunnel_url "${LOG_DIR}/frontend-tunnel.log" || true)
  BACK_URL=$(extract_tunnel_url "${LOG_DIR}/backend-tunnel.log" || true)
  if [[ -n "${FRONT_URL}" && -n "${BACK_URL}" ]]; then
    break
  fi
  sleep 1
done

echo ""
echo "Frontend URL: ${FRONT_URL:-not ready yet (check ${LOG_DIR}/frontend-tunnel.log)}"
echo "Backend URL:  ${BACK_URL:-not ready yet (check ${LOG_DIR}/backend-tunnel.log)}"
echo ""
echo "Set these before sharing:"
echo "1) cbh-fixed-frontend/.env.local -> NEXT_PUBLIC_API_URL=${BACK_URL}/api/v1"
echo "2) cbh-fixed-backend/.env -> ALLOW_TRYCLOUDFLARE_ORIGINS=true"
echo "3) Restart backend/frontend after env changes"
echo ""
echo "Keeping tunnels alive. Press Ctrl+C to stop."

wait
