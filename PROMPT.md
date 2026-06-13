# CS-PVP-Lite — Discord Activity 2v2 Shooter

Build a Discord Activity (embedded app) in this directory: a browser-based, first-person 2v2 shooter inspired by Counter-Strike 2's community map **aim_map**. Players launch the Activity from a Discord voice channel, pick teams, and fight short rounds; when both players on a team are dead, the round ends, the score updates, and everyone respawns for the next round.

## Reference material
- `aim-map.jpg` in this directory shows the map I want: a flat, sandy, Dust2-style walled arena with wooden crates scattered through the middle as cover, and the two teams spawning on opposite ends. Recreate this layout and vibe (sand/concrete textures or colors, crate obstacles, perimeter walls, skybox) — it doesn't need to be a 1:1 copy, but it should be instantly recognizable as aim_map.
- Gameplay reference: https://www.youtube.com/watch?v=A1kSyZdsQME — fast rifle duels across the crates, instant respawn-style rounds, no objectives, just kills.
- Discord developer docs: https://docs.discord.com/developers/intro — follow the current Embedded App SDK / Activities documentation. Verify against the live docs rather than assuming; the Activities platform changes often.

## Tech stack
- **Client:** Vite + TypeScript + Three.js for the 3D first-person rendering. Pointer Lock API for mouse look.
- **Server:** Node.js with an authoritative game server over WebSockets (plain `ws` or Colyseus — your choice, justify it). The server owns all game state: positions, health, hit detection, round state, scores. Clients send inputs; server broadcasts snapshots. Never trust the client for hits or health.
- **Discord:** `@discordjs/embedded-app-sdk` for the Activity handshake, OAuth2 authorization code flow on the server to exchange the token, and participant info (username + avatar) pulled from Discord so players appear with their real identities.
- Monorepo layout: `/client`, `/server`, shared types in `/shared`.

## Discord Activity constraints (get these right)
- Activities run inside Discord's sandboxed iframe behind their proxy. All external requests must go through **URL mappings** with the `/.proxy/` path prefix — configure the Vite dev server and the WebSocket URL accordingly.
- Respect the Activity CSP rules: no direct third-party URLs from the client; assets served from the app's own mapped origin.
- Provide a `.env.example` with `VITE_DISCORD_CLIENT_ID`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` placeholders, and a README section that walks me through: creating the app in the Discord Developer Portal, enabling Activities, setting URL mappings, OAuth2 redirect, and testing with a `cloudflared` tunnel before the app is hosted publicly.
- Also support a **local browser dev mode** (a flag that skips the Discord SDK handshake and uses a fake username) so the game can be developed and tested outside Discord.

## Map
- Rectangular arena roughly proportioned like aim_map: long axis between the two spawn zones, raised spawn platforms on each end with short ramps/steps down to the main floor, low perimeter walls players can't escape, and a center field of wooden crates of varying sizes (some single-crate height for cover you can shoot over while standing, some stacked doubles you must peek around).
- Crates and walls are full collision objects for both movement and bullets.
- Simple lighting (hemisphere + directional sun) and a desert skybox color is fine — readability over realism. Keep it performant; this runs inside Discord's iframe on mid-range machines.

## Gameplay
- **Movement:** WASD, mouse look, jump (Space), CS-like feel — brisk strafing, slight air control, no sprint mechanic. Capsule collision against the map.
- **Weapon:** one hitscan rifle (AK-47 style). Left click fires; full auto with a fire-rate cap, spread that grows while moving/spraying, damage falloff optional. Headshot zone deals extra damage (kill in 1–2 hits vs ~4 body shots from a 100 HP pool). Magazine of 30 with R to reload (~2.5s). Infinite reserve ammo.
- **Health:** 100 HP, no regen during a round. Death turns you into a spectator of a living teammate until the round ends.
- **Hit feedback:** crosshair, hitmarker, damage direction indicator, simple tracers and muzzle flash, death screen showing who killed you.

## Lobby and game flow
1. Players join the Activity from a voice channel and land in a **lobby screen** listing all participants with their Discord avatars/names.
2. Players click to join **Team T or Team CT** (max 2 per team). It should still work as 1v1 if only two people join, but cap at 2v2.
3. Any player can hit **Start Game** once both teams have at least one player. Late joiners while a game is running become spectators or can fill an open slot between rounds.
4. On start: countdown, then everyone spawns at their team's end and the first round begins.

## Rounds and scoring
- A round ends when **every player on one team is dead** — the surviving team scores 1 point.
- Show a round-end banner ("Team T wins the round"), then a ~5s freeze/buy-less intermission, then all players respawn at their spawns with full HP/ammo and the next round starts.
- Persistent **scoreboard**: Tab key shows team scores plus per-player kills/deaths for the session. Team scores also live in a compact always-visible HUD element (top center, CS style).
- First team to **8 round wins** takes the match; show a match-over screen with the final scoreboard and a "Play Again" button that resets scores and returns to the lobby state.
- Kill feed in the top right (killer ▸ victim, headshot icon).

## Networking details
- Server tick (~20–30 Hz) broadcasting state snapshots; client-side interpolation for remote players and client prediction for your own movement so it feels responsive.
- Server-side hitscan validation using its own authoritative positions.
- Handle disconnects gracefully: a player dropping mid-round counts as dead; an empty team forfeits the round; the lobby reflects who's still connected.
- One game instance per Discord voice channel (key rooms by the Activity's `instanceId`).

## Deliverables
- Working client + server with the structure above, `README.md` with setup/run/deploy instructions, and `.env.example`.
- `npm run dev` should boot both client and server for local browser testing in dev mode.
- Verify the game compiles and the server runs locally; the Discord Developer Portal steps that need my account should be clearly listed in the README for me to do manually.

Build it incrementally and keep me posted: get the local-browser version of the game fully playable first (map, movement, shooting, bots-free 2v2 rounds with multiple browser tabs), then layer in the Discord Activity integration.
