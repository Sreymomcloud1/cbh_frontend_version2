#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/cbh-fixed-backend"
FRONTEND_DIR="${ROOT_DIR}/cbh-fixed-frontend"

if [[ ! -d "${BACKEND_DIR}" || ! -d "${FRONTEND_DIR}" ]]; then
  echo "Expected cbh-fixed-backend and cbh-fixed-frontend under ${ROOT_DIR}"
  exit 1
fi

cleanup() {
  echo ""
  echo "Stopping backend and frontend..."
  if [[ -n "${BACKEND_PID:-}" ]]; then kill "${BACKEND_PID}" 2>/dev/null || true; fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then kill "${FRONTEND_PID}" 2>/dev/null || true; fi
}

trap cleanup INT TERM EXIT

echo "Starting backend (hot reload enabled)..."
(
  cd "${BACKEND_DIR}"
  npm run dev
) &
BACKEND_PID=$!

echo "Starting frontend..."
(
  cd "${FRONTEND_DIR}"
  npm run dev
) &
FRONTEND_PID=$!

echo "Backend PID: ${BACKEND_PID}"
echo "Frontend PID: ${FRONTEND_PID}"
echo "Press Ctrl+C to stop both."

wait
