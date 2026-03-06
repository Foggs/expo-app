# Local Development

This project is intended to be run with the automated local script.

## Quick Start (Web)

From the project root:

```bash
bash scripts/dev-local.sh --web
```

Then open:

- `http://localhost:8081` (Expo web app)

The script will:

- validate required tools + Node version
- start/check local Postgres (`sketchduel-pg`)
- run `npm run db:push`
- start backend server on port `5050`
- start Expo web dev server

Stop everything with `Ctrl+C` in that terminal.

## Quick Start (Mobile)

For Expo Go / device testing:

```bash
bash scripts/dev-local.sh --mobile --ngrok
```

This starts ngrok automatically and sets `EXPO_PUBLIC_DOMAIN` for you.

## Requirements

- Node.js `18+`
- npm
- Docker Desktop (for local Postgres)
- ngrok (only for `--mobile --ngrok`)

## Useful Script Options

```bash
bash scripts/dev-local.sh --help
```

Common options:

- `--web` (default)
- `--mobile`
- `--ngrok` (usually with mobile)
- `--no-db-push`
- `--no-postgres`

## Ports and Endpoints

- Backend API + WebSocket: `http://localhost:5050` and `ws://127.0.0.1:5050/ws`
- Expo web dev server: `http://localhost:8081`

Health checks:

```bash
curl -fsS http://localhost:5050/api/health
curl -H 'Authorization: Bearer dev-local-token' http://localhost:5050/api/games
```

## Verify Two-Browser Matchmaking (WebSocket)

1. Start local dev:

```bash
bash scripts/dev-local.sh --web
```

2. Open two separate browser sessions at `http://localhost:8081`.

- Use separate browser profiles or one normal window + one private/incognito window.
- In each session, press the in-app action to find/join a match.

3. Confirm connections:

- Browser DevTools -> Network -> WS should show a connection to `ws://127.0.0.1:5050/ws`.
- Server log should show both users joining queue and `Match created`.

```bash
tail -n 80 .dev-logs/server.log
```

## Logs

- Backend: `.dev-logs/server.log`
- ngrok: `.dev-logs/ngrok.log`

## Troubleshooting

### Docker is not running

Start Docker Desktop, then rerun `bash scripts/dev-local.sh --web`.

### Backend port conflict (`5050`)

Check what owns port `5050`:

```bash
lsof -nP -iTCP:5050 -sTCP:LISTEN
```

Stop the conflicting process or set a different `SERVER_PORT` when starting.

### Expo loads but players never match

Check `.dev-logs/server.log`.

- If you see two queue joins but no `Match created`, there is a backend/database issue.
- If no websocket entries appear, confirm both browsers are on `http://localhost:8081` and WS connects to `ws://127.0.0.1:5050/ws`.

### Re-running cleanly

If state is stuck, stop the script (`Ctrl+C`) and start again:

```bash
bash scripts/dev-local.sh --web
```
