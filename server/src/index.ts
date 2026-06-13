import { config as dotenv } from 'dotenv';
import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMsg } from '@cs/shared';
import { Room } from './room.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from the repo root regardless of which cwd npm gives us.
dotenv({ path: path.resolve(__dirname, '../../.env') });
dotenv();

// GAME_PORT (not PORT) so generic tooling that injects PORT can't collide
// with the vite dev server.
const PORT = Number(process.env.GAME_PORT ?? 3001);
const app = express();
app.use(express.json());

// OAuth2 token exchange for the Discord Embedded App SDK authenticate() step.
app.post('/api/token', async (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(500).json({ error: 'DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET not configured' });
    return;
  }
  const code = req.body?.code;
  if (typeof code !== 'string') {
    res.status(400).json({ error: 'missing code' });
    return;
  }
  try {
    const r = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
      }),
    });
    const data = (await r.json()) as { access_token?: string };
    if (!r.ok || !data.access_token) {
      console.error('token exchange failed', r.status, data);
      res.status(502).json({ error: 'token exchange failed' });
      return;
    }
    res.json({ access_token: data.access_token });
  } catch (err) {
    console.error('token exchange error', err);
    res.status(502).json({ error: 'token exchange error' });
  }
});

// Dev-only: lets automated tooling dump a rendered frame to disk for inspection.
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/debug-frame', express.json({ limit: '5mb' }), async (req, res) => {
    const { writeFile } = await import('node:fs/promises');
    const file = path.resolve(__dirname, '../../scripts/frame.jpg');
    await writeFile(file, Buffer.from(String(req.body?.b64 ?? ''), 'base64'));
    res.json({ saved: file });
  });
}

// In production, serve the built client from the same origin.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

const rooms = new Map<string, Room>();

// Heartbeat: phones that sleep and tunneled clients that vanish never send a
// TCP FIN, so without pings their player entities would linger as ghosts.
const aliveSockets = new WeakSet<WebSocket>();
const heartbeat = setInterval(() => {
  for (const client of wss.clients) {
    if (!aliveSockets.has(client)) {
      client.terminate(); // fires 'close' -> removePlayer
      continue;
    }
    aliveSockets.delete(client);
    client.ping();
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

wss.on('connection', (ws: WebSocket) => {
  let room: Room | null = null;
  aliveSockets.add(ws);
  ws.on('pong', () => aliveSockets.add(ws));
  // Any application message also counts as proof of life.
  ws.on('message', () => aliveSockets.add(ws));

  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (room === null) {
      if (msg.t !== 'hello') return;
      const instanceId = typeof msg.instanceId === 'string' && msg.instanceId ? msg.instanceId.slice(0, 64) : 'dev';
      let r = rooms.get(instanceId);
      if (!r) {
        r = new Room(instanceId, () => rooms.delete(instanceId));
        rooms.set(instanceId, r);
        console.log(`room created: ${instanceId}`);
      }
      room = r;
      room.addPlayer(ws, String(msg.name ?? 'Player'), typeof msg.avatarUrl === 'string' ? msg.avatarUrl : null);
      return;
    }
    room.handleMessage(ws, msg);
  });

  ws.on('close', () => {
    room?.removePlayer(ws);
    room = null;
  });
  ws.on('error', () => {
    room?.removePlayer(ws);
    room = null;
  });
});

httpServer.listen(PORT, () => {
  console.log(`CS-PVP-Lite server listening on http://localhost:${PORT} (ws path /ws)`);
});
