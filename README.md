# CS PVP Lite

A Discord Activity: a browser-based 2v2 first-person shooter inspired by Counter-Strike 2's
**aim_map**. Players launch it from a Discord voice channel, pick teams, and fight short rounds —
when every player on a team is dead, the round ends, the score ticks up, and everyone respawns.
First team to **8 rounds** wins the match.

- **Client:** Vite + TypeScript + Three.js (pointer-lock FPS controls, client-side prediction)
- **Server:** Node.js + Express + `ws` — fully authoritative (positions, hits, health, rounds)
- **Shared:** deterministic movement/physics + map definition used by both sides
- **Discord:** `@discord/embedded-app-sdk` with OAuth2 token exchange; falls back to a guest
  identity when opened in a plain browser, so the game is fully playable without Discord.

## Quick start (local, no Discord needed)

```bash
npm install
npm run dev
```

Open http://localhost:5173 in **two or more browser tabs/windows** — each tab is a player.
Join Team T in one tab, Team CT in another, and hit **Start Game**.

Playing alone? Click **+ Add Bot** on either team in the lobby — server-side AI bots fill empty
slots, navigate the map, and fight with humanized aim (and you can mix them freely with humans,
e.g. you + a bot vs. two bots).

### Mobile

Phones and tablets get touch controls automatically (force them with `?touch=1`): left side of
the screen is a virtual movement joystick, dragging the right side looks around, and on-screen
buttons handle fire / jump / reload / pickup (E) / AWP scope. Landscape orientation recommended —
the game shows a rotate hint in portrait.

### Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look (click the game to capture the cursor) |
| Left click | Fire (full-auto AK, 600 RPM) |
| Right click | AWP scope |
| R | Reload (~2.5 s, 30-round mag, infinite reserve) |
| E | Pick up weapon (your current gun drops in its place) |
| Space | Jump |
| Tab (hold) | Scoreboard |
| Esc | Release cursor |

Damage: 30 body / 100 headshot, 100 HP, no regen. Spread grows while moving, spraying, or
airborne — stand still and tap for laser accuracy, just like the real thing.

## Project layout

```
shared/   constants, types, aim_map geometry (AABBs), deterministic movement + raycast physics
server/   authoritative game server: rooms per Discord activity instance, 30 Hz tick,
          server-side hitscan, lobby/round/match state machine, OAuth token endpoint
client/   Three.js renderer, prediction + reconciliation, interpolation for remote players,
          HUD (scores, kill feed, scoreboard, banners), lobby UI, Discord SDK handshake
scripts/  headless tests (e2e, spray, pickup, bot-match) + bot.mjs (dummy external client)
```

The server is the single source of truth: clients only send inputs (`{move, yaw, pitch, fire}`),
and the server simulates movement, validates every shot with its own raycast, and broadcasts
30 Hz snapshots. Your own player is predicted locally and reconciled against the server, so it
feels instant even with latency. Rooms are keyed by the Discord activity `instanceId`, so each
voice channel gets its own independent match.

## Testing

With `npm run dev` running:

```bash
node scripts/e2e.mjs         # full match loop: lobby -> kills -> scoring -> respawn -> forfeit
node scripts/spray-test.mjs  # asserts the CS2-style AK spray shape (climb -> left -> right)
node scripts/pickup-test.mjs # walks to the M4, picks it up, verifies the swap + dropped AK
node scripts/bot-match-test.mjs # lobby add/remove bots, then a live bot must navigate and fight
```

## Discord Activity setup

These steps need your Discord account (one-time setup):

1. **Create the app** at https://discord.com/developers/applications → *New Application*.
2. **Enable Activities:** in the left sidebar choose **Activities → Settings** (or *Embedded App*
   settings) and enable the Activity for your app.
3. **Get credentials:** copy the **Application ID** and, under **OAuth2**, the **Client Secret**.
   Then in this repo:
   ```bash
   cp .env.example .env   # then fill in the values
   ```
   - `VITE_DISCORD_CLIENT_ID` = Application ID
   - `DISCORD_CLIENT_ID` = Application ID
   - `DISCORD_CLIENT_SECRET` = OAuth2 client secret
4. **OAuth2 redirect:** under **OAuth2 → Redirects** add any valid URL (e.g. your tunnel URL).
   The embedded flow uses `response_type=code` with the SDK, but Discord requires at least one
   redirect to be registered.
5. **Expose your dev server with a tunnel** (Discord must reach it over HTTPS):
   ```bash
   npm run dev                                   # terminal 1
   cloudflared tunnel --url http://localhost:5173  # terminal 2
   ```
   Note the `https://<random>.trycloudflare.com` URL it prints.
   (Install cloudflared from https://developers.cloudflare.com/cloudflared/ or use ngrok.)
6. **URL mapping:** in the developer portal under **Activities → URL Mappings**, set the root
   mapping `/` → `<random>.trycloudflare.com` (no protocol). All activity traffic is proxied
   through `https://<app-id>.discordsays.com/.proxy/...` — the client already prefixes its
   API/WebSocket calls with `/.proxy` when embedded, and the Vite dev server forwards `/api`
   and `/ws` to the game server.
7. **Launch it:** enable **Developer Mode** in your Discord client (User Settings → Advanced),
   join a voice channel, and open the Activity Launcher (rocket icon) — your app appears under
   *Developer* apps. Add a friend (or a second account) for a real 2v2.

### Production hosting

```bash
npm run build   # builds client/dist
npm start       # serves client/dist + API + WebSocket on GAME_PORT (default 3001)
```

Host that single Node process anywhere with HTTPS (the platform's domain goes in the URL
mapping instead of the tunnel). The server serves the built client, the token endpoint
(`/api/token`), and the WebSocket (`/ws`) from one origin — no extra config needed.

## Tuning

Most gameplay numbers live in [shared/src/constants.ts](shared/src/constants.ts): round count to
win, countdown/intermission lengths, damage, fire rate, spread, movement speed, team size.
The map layout (crates, walls, platforms, spawns) is defined in
[shared/src/map.ts](shared/src/map.ts) — both rendering and collision are generated from the
same data, so editing it changes the real map.
