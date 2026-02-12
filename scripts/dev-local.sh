#!/usr/bin/env bash
set -Eeuo pipefail

MODE="web"
USE_NGROK="0"
RUN_DB_PUSH="1"
START_POSTGRES="1"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-sketchduel-pg}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-sketchduel}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
SERVER_PORT="${SERVER_PORT:-5050}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/.dev-logs"
SERVER_LOG="${LOG_DIR}/server.log"
NGROK_LOG="${LOG_DIR}/ngrok.log"

SERVER_PID=""
NGROK_PID=""

is_backend_healthy() {
  curl -fsS "http://localhost:${SERVER_PORT}/api/health" >/dev/null 2>&1
}

is_port_in_use() {
  lsof -nP -iTCP:"${SERVER_PORT}" -sTCP:LISTEN >/dev/null 2>&1
}

print_port_owner() {
  lsof -nP -iTCP:"${SERVER_PORT}" -sTCP:LISTEN || true
}

usage() {
  cat <<'EOF'
Usage: bash scripts/dev-local.sh [options]

Options:
  --web                 Start Expo in web mode (default).
  --mobile              Start Expo for mobile (Expo Go).
  --ngrok               Start ngrok tunnel (recommended with --mobile).
  --no-db-push          Skip "npm run db:push".
  --no-postgres         Skip Postgres container startup checks.
  -h, --help            Show help.

Examples:
  bash scripts/dev-local.sh --web
  bash scripts/dev-local.sh --mobile --ngrok
EOF
}

log() {
  printf '[dev-local] %s\n' "$*"
}

die() {
  printf '[dev-local] ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [[ -n "${NGROK_PID}" ]] && kill -0 "${NGROK_PID}" 2>/dev/null; then
    log "Stopping ngrok (pid ${NGROK_PID})"
    kill "${NGROK_PID}" || true
  fi

  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    log "Stopping backend server (pid ${SERVER_PID})"
    kill "${SERVER_PID}" || true
  fi
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

check_node_version() {
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "${major}" -lt 18 ]]; then
    die "Node.js 18+ required. Current: $(node -v)"
  fi
}

setup_env() {
  export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}}"
  export PORT="${PORT:-${SERVER_PORT}}"
  export API_AUTH_TOKEN="${API_AUTH_TOKEN:-dev-local-token}"
  export EXPO_PUBLIC_API_AUTH_TOKEN="${EXPO_PUBLIC_API_AUTH_TOKEN:-${API_AUTH_TOKEN}}"
  export EXPO_PUBLIC_SERVER_PORT="${EXPO_PUBLIC_SERVER_PORT:-${SERVER_PORT}}"
  if [[ "${MODE}" == "web" ]]; then
    export EXPO_PUBLIC_DOMAIN="${EXPO_PUBLIC_DOMAIN:-localhost:${SERVER_PORT}}"
  fi
}

ensure_postgres_container() {
  if [[ "${START_POSTGRES}" != "1" ]]; then
    log "Skipping Postgres startup checks (--no-postgres)."
    return
  fi

  require_command docker

  if ! docker info >/dev/null 2>&1; then
    die "Docker is not running. Start Docker Desktop and rerun."
  fi

  if docker ps -a --format '{{.Names}}' | grep -qx "${POSTGRES_CONTAINER}"; then
    if ! docker ps --format '{{.Names}}' | grep -qx "${POSTGRES_CONTAINER}"; then
      log "Starting existing Postgres container: ${POSTGRES_CONTAINER}"
      docker start "${POSTGRES_CONTAINER}" >/dev/null
    else
      log "Postgres container is already running: ${POSTGRES_CONTAINER}"
    fi
  else
    log "Creating Postgres container: ${POSTGRES_CONTAINER}"
    docker run --name "${POSTGRES_CONTAINER}" \
      -e "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
      -e "POSTGRES_DB=${POSTGRES_DB}" \
      -p "${POSTGRES_PORT}:5432" \
      -d postgres:16 >/dev/null
  fi

  log "Waiting for Postgres readiness..."
  local max_tries=30
  local i
  for ((i=1; i<=max_tries; i++)); do
    if docker exec "${POSTGRES_CONTAINER}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
      log "Postgres is ready."
      return
    fi
    sleep 1
  done
  die "Postgres did not become ready in time."
}

run_db_push() {
  if [[ "${RUN_DB_PUSH}" != "1" ]]; then
    log "Skipping db:push (--no-db-push)."
    return
  fi

  log "Applying database schema (npm run db:push)..."
  (cd "${ROOT_DIR}" && npm run db:push)
}

start_backend() {
  mkdir -p "${LOG_DIR}"
  : > "${SERVER_LOG}"

  if is_backend_healthy; then
    log "Backend already running and healthy on port ${SERVER_PORT}; reusing existing process."
    return
  fi

  if is_port_in_use; then
    log "Port ${SERVER_PORT} is already in use and /api/health is not responding."
    print_port_owner
    die "Free port ${SERVER_PORT} or stop conflicting process, then retry."
  fi

  log "Starting backend server on port ${SERVER_PORT}..."
  (
    cd "${ROOT_DIR}"
    npm run server:dev
  ) >"${SERVER_LOG}" 2>&1 &
  SERVER_PID="$!"

  log "Waiting for backend health check at http://localhost:${SERVER_PORT}/api/health ..."
  local max_tries=40
  local i
  for ((i=1; i<=max_tries; i++)); do
    if is_backend_healthy; then
      log "Backend is healthy."
      return
    fi
    if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
      if rg -q "EADDRINUSE" "${SERVER_LOG}" 2>/dev/null; then
        log "Backend failed to start: port ${SERVER_PORT} is already in use."
        print_port_owner
      fi
      die "Backend exited early. Check log: ${SERVER_LOG}"
    fi
    sleep 1
  done
  log "Backend health check timed out. Recent server log:"
  tail -n 40 "${SERVER_LOG}" || true
  die "Backend health check timed out. Check log: ${SERVER_LOG}"
}

extract_ngrok_domain() {
  curl -fsS "http://127.0.0.1:4040/api/tunnels" \
    | node -e '
      let raw = "";
      process.stdin.on("data", (d) => (raw += d));
      process.stdin.on("end", () => {
        const data = JSON.parse(raw);
        const tunnel = (data.tunnels || []).find((t) => typeof t.public_url === "string" && t.public_url.startsWith("https://"));
        if (!tunnel) process.exit(2);
        const u = new URL(tunnel.public_url);
        process.stdout.write(u.host);
      });
    '
}

start_ngrok() {
  require_command ngrok
  mkdir -p "${LOG_DIR}"
  : > "${NGROK_LOG}"

  log "Starting ngrok tunnel to localhost:${SERVER_PORT} ..."
  (
    cd "${ROOT_DIR}"
    ngrok http "${SERVER_PORT}"
  ) >"${NGROK_LOG}" 2>&1 &
  NGROK_PID="$!"

  local max_tries=25
  local i
  local domain=""
  for ((i=1; i<=max_tries; i++)); do
    if ! kill -0 "${NGROK_PID}" 2>/dev/null; then
      die "ngrok exited early. Check log: ${NGROK_LOG}"
    fi
    if domain="$(extract_ngrok_domain 2>/dev/null)"; then
      if [[ -n "${domain}" ]]; then
        export EXPO_PUBLIC_DOMAIN="${domain}"
        log "Using EXPO_PUBLIC_DOMAIN=${EXPO_PUBLIC_DOMAIN}"
        return
      fi
    fi
    sleep 1
  done

  die "Could not detect ngrok public URL. Check log: ${NGROK_LOG}"
}

run_expo() {
  log "Environment summary:"
  log "  DATABASE_URL=${DATABASE_URL}"
  log "  PORT=${PORT}"
  log "  API_AUTH_TOKEN=[set]"
  log "  EXPO_PUBLIC_API_AUTH_TOKEN=[set]"
  log "  EXPO_PUBLIC_SERVER_PORT=${EXPO_PUBLIC_SERVER_PORT}"
  if [[ -n "${EXPO_PUBLIC_DOMAIN:-}" ]]; then
    log "  EXPO_PUBLIC_DOMAIN=${EXPO_PUBLIC_DOMAIN}"
  fi

  if [[ "${MODE}" == "web" ]]; then
    log "Starting Expo web..."
    (cd "${ROOT_DIR}" && npm start -- --web)
  else
    log "Starting Expo mobile..."
    (cd "${ROOT_DIR}" && npm start)
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --web)
        MODE="web"
        shift
        ;;
      --mobile)
        MODE="mobile"
        shift
        ;;
      --ngrok)
        USE_NGROK="1"
        shift
        ;;
      --no-db-push)
        RUN_DB_PUSH="0"
        shift
        ;;
      --no-postgres)
        START_POSTGRES="0"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1 (use --help)"
        ;;
    esac
  done
}

main() {
  parse_args "$@"
  trap cleanup EXIT INT TERM

  require_command node
  require_command npm
  require_command curl
  check_node_version

  setup_env
  ensure_postgres_container
  run_db_push
  start_backend

  if [[ "${MODE}" == "mobile" && "${USE_NGROK}" == "1" ]]; then
    start_ngrok
  fi

  if [[ "${MODE}" == "mobile" && -z "${EXPO_PUBLIC_DOMAIN:-}" ]]; then
    log "Mobile mode without EXPO_PUBLIC_DOMAIN."
    log "Set EXPO_PUBLIC_DOMAIN manually or rerun with --ngrok."
  fi

  run_expo
}

main "$@"
