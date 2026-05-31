# Sandy Pong (server)

Multiplayer authority for the Pong game embedded at https://borkbook.com/games/sandy-pong/. This repo is the Socket.IO server only — the static client lives in [`tracer-workspace`](https://github.com/BunPrinceton/tracer-workspace) under `games/sandy-pong/index.html`.

- **Live**: https://sandy-pong-server.onrender.com (Render free tier)
- **Health**: https://sandy-pong-server.onrender.com/health → `{ok, rooms, ips}`
- **Play**: https://borkbook.com/games/sandy-pong/

## What it does

- Hosts invite-only 2-player rooms keyed by 5-char codes (`[A-Z2-9]`, no confusables)
- Authoritative physics @ 60 Hz; clients only send paddle direction (`'up' | 'down' | null`)
- Broadcasts game state to both players over Socket.IO
- First to 7 wins; rematch supported (host only)

For solo/offline play, the **client** has a separate bot mode that runs the same physics in the browser — it does not touch this server.

## Run locally

```bash
npm install
npm run dev        # concurrently: server on :4000, Vite dev client on :5173
# or:
npm start          # server only, no client
```

`client/` is a Vite + React dev sandbox for iterating on UI ideas; not used in production.

## Deploy

Already deployed via `render.yaml` (Blueprint). To redeploy: push to `main`; Render auto-deploys on commit (`autoDeploy: true`).

To reproduce from scratch on a new Render account:
1. Fork/clone this repo to your GitHub.
2. Render dashboard → **New +** → **Blueprint** → select the repo → **Apply**.
3. Render reads `render.yaml`, creates the `sandy-pong-server` web service (Free plan).
4. Note the URL; if it isn't `sandy-pong-server.onrender.com`, update `DEFAULT_WS` in the static client (`tracer-workspace/games/sandy-pong/index.html`) and push that repo too.

**Free tier note**: the service sleeps after ~15 min idle. First request after sleep takes ~30 s to wake. The client shows a "Waking the rally" overlay during this window.

## Protocol

Socket.IO events (client ↔ server):

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `create` | C→S | — | Generates room code, makes caller `left` (host) |
| `join` | C→S | `string` (code) | Joins as `right`; validates `^[A-Z0-9]{5}$` |
| `joined` | S→C | `{code, side}` | Caller's assignment |
| `roomState` | S→C(room) | `{code, players, state}` | Sent on join/start/disconnect |
| `start` | C→S | — | Host only; flips `running = true` |
| `input` | C→S | `'up' \| 'down' \| null` | Per-frame paddle direction |
| `state` | S→C(room) | full game state | Broadcast at 60 Hz while `running` |
| `rematch` | C→S | — | Host only; resets state |
| `opponent_left` | S→C(room) | — | When the other player disconnects |
| `error_msg` | S→C | `string` | Human-readable error |

## Hardening

- **CORS allowlist**: `borkbook.com`, `bunprinceton.github.io`, `localhost:5173/4173`
- **Rate limits** (per-IP, sliding 60 s window): `create` ≤ 5, `join` ≤ 15
- **Concurrent rooms cap**: 200 (rejects further `create` with "server busy")
- **Payload cap**: 1 KB (`maxHttpBufferSize`)
- **Input validation**: room-code regex, paddle-direction enum
- **Host-only authorization** on `start` and `rematch`
- **Auto-cleanup** every 30 s: empty rooms drop after 60 s grace; idle rooms (no input 15 min) close; unstarted lobbies expire at 30 min
- **Real client IP**: `app.set('trust proxy', 1)` so the rate limiter reads `X-Forwarded-For` behind Render's LB
- **No persistence**: rooms are in-memory only; nothing is written to disk

## Stack

- Node.js 20 (`engines.node >= 20`)
- Express ^4.19
- Socket.IO ^4.7
- Deploy: Render (Blueprint via `render.yaml`)

## Costs

$0 — Render free tier (750 hr/mo runtime, 100 GB/mo egress; Pong's tiny payloads make egress a non-issue).
