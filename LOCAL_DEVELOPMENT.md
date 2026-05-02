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

For Expo Go / device testing on local Wi-Fi (recommended):

```bash
npm run local:dev:mobile
```

This uses `scripts/dev-local.sh --mobile --lan`, auto-detects your LAN IP, and sets `EXPO_PUBLIC_DOMAIN=http://<lan-ip>:5050` for native API + WebSocket.

Alternative (tunnel):

```bash
npm run local:dev:mobile:ngrok
```

Use ngrok if LAN connectivity is not possible.

## Requirements

- Node.js `18+`
- npm
- Docker Desktop (for local Postgres)
- ngrok (optional, only for `npm run local:dev:mobile:ngrok`)

## Useful Script Options

```bash
bash scripts/dev-local.sh --help
```

Common options:

- `--web` (default)
- `--mobile`
- `--lan` (auto-detect LAN IP for mobile and set `EXPO_PUBLIC_DOMAIN`)
- `--ngrok` (usually with mobile)
- `--no-db-push`
- `--no-postgres`

## Ports and Endpoints

- Backend API + WebSocket: `http://localhost:5050` and `ws://127.0.0.1:5050/ws`
- Expo web dev server: `http://localhost:8081`
- Mobile LAN mode uses `EXPO_PUBLIC_DOMAIN=http://<your-lan-ip>:5050` (for example `http://192.168.1.239:5050`)

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

### Mobile shows "WebSocket connection error"

1. Make sure Expo was started with `EXPO_PUBLIC_DOMAIN` set to your LAN backend URL:

```bash
npm run local:dev:mobile
```

2. Ensure phone and laptop are on the same Wi-Fi.
3. Fully close and reopen Expo Go, then reconnect.
4. Check backend log for origin rejection:

```bash
tail -n 120 .dev-logs/server.log
```

If you see `WebSocket connection rejected: invalid origin ...`, your `EXPO_PUBLIC_DOMAIN` value does not match the reachable backend host for that device.

### ngrok URL does not work on this network

Some networks/ISPs block ngrok domains. If tunnel mode fails, use LAN mode (`EXPO_PUBLIC_DOMAIN=http://<lan-ip>:5050`) instead.

### Re-running cleanly

If state is stuck, stop the script (`Ctrl+C`) and start again:

```bash
bash scripts/dev-local.sh --web
```
