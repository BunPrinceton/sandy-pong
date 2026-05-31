# Sandy Pong

Luxury multiplayer Pong with invite-only room codes. Static client lives on borkbook.com; this repo is just the realtime server.

## Local dev (full stack)

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:4000

## Production server only

Render deploys `server.js` directly. The static client (under `client/`) is for local dev — borkbook hosts its own copy at `/games/sandy-pong/`.

## Deploying the server to Render

1. Push this repo to GitHub.
2. https://dashboard.render.com → **New +** → **Web Service** → connect the repo.
3. Render reads `render.yaml` and picks `sandy-pong-server`. Click **Apply**.
4. Wait ~2 min for the first build. URL will be something like `https://sandy-pong-server.onrender.com`.
5. If your service URL differs from `sandy-pong-server.onrender.com`, edit `DEFAULT_WS` in `tracer-workspace/games/sandy-pong/index.html` to match.

**Free-tier note:** the server sleeps after ~15 min of inactivity. First request after sleep takes ~30 s to wake — the game page shows a "Waking the rally" overlay during that time.

## Protocol

Socket.IO events (client ↔ server):
- `create` → `joined { code, side: 'left' }` + `roomState`
- `join` (code) → `joined { code, side: 'right' }` + `roomState`, or `error_msg`
- `start` (host only) → `roomState` with `state.running = true`
- `input` ('up' | 'down' | null) per player
- `state` (server broadcast @60Hz while running)
- `rematch` (host only)
- `opponent_left` (broadcast)
