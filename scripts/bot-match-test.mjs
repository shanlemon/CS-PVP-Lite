// Verifies in-game bots: add/remove in lobby, then a live bot must navigate
// (move several meters) and fight (fire shots / damage the idle human).
// Usage: node scripts/bot-match-test.mjs   (expects the server on :3001)
import WebSocket from 'ws';

import { gamePort } from './port.mjs';

const URL = `ws://localhost:${gamePort()}/ws`;
const ROOM = 'bots-' + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

const c = { id: null, room: null, you: null, players: [], seq: 0, botShots: 0, damaged: false, kills: [] };
const ws = new WebSocket(URL);
await new Promise((resolve, reject) => {
  ws.on('open', () => {
    ws.send(JSON.stringify({ t: 'hello', name: 'Human', avatarUrl: null, instanceId: ROOM }));
    resolve();
  });
  ws.on('error', reject);
});
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.t === 'welcome') { c.id = m.id; c.room = m.room; }
  else if (m.t === 'room') c.room = m.room;
  else if (m.t === 'snap') { c.you = m.you; c.players = m.players; }
  else if (m.t === 'shot' && m.shooterId !== c.id) c.botShots++;
  else if (m.t === 'damage') c.damaged = true;
  else if (m.t === 'kill') c.kills.push(m);
});

async function until(desc, cond, timeoutMs = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (cond()) return;
    await sleep(50);
  }
  fail(`timeout: ${desc}`);
}

await sleep(200);
ws.send(JSON.stringify({ t: 'team', team: 'T' }));

// Add two bots, remove one.
ws.send(JSON.stringify({ t: 'addBot', team: 'CT' }));
await until('CT bot in roster', () => c.room?.players?.some((p) => p.bot && p.team === 'CT'));
ws.send(JSON.stringify({ t: 'addBot', team: 'T' }));
await until('T bot in roster', () => c.room.players.some((p) => p.bot && p.team === 'T'));
const tBot = c.room.players.find((p) => p.bot && p.team === 'T');
console.log('ok: bots added:', c.room.players.filter((p) => p.bot).map((p) => `${p.name}(${p.team})`).join(', '));

ws.send(JSON.stringify({ t: 'removeBot', id: tBot.id }));
await until('T bot removed', () => !c.room.players.some((p) => p.id === tBot.id));
console.log('ok: bot removal works');

const ctBot = c.room.players.find((p) => p.bot && p.team === 'CT');

// Start: 1 human (T) vs 1 bot (CT).
ws.send(JSON.stringify({ t: 'start' }));
await until('live', () => c.room.phase === 'live', 8000);
console.log('ok: match started vs bot');

// Keep the human "connected-looking": send idle inputs so the server processes us.
const pump = setInterval(() => {
  c.seq++;
  ws.send(JSON.stringify({ t: 'inputs', inputs: [{ seq: c.seq, dt: 0.033, mx: 0, mz: 0, jump: false, yaw: 0, pitch: 0, fire: false, reload: false, use: false, zoom: false }] }));
}, 50);

// Watch the bot for up to 30s: it must move several meters and fight.
const start = Date.now();
let origin = null;
let maxDist = 0;
while (Date.now() - start < 30000) {
  const snap = c.players.find((p) => p.id === ctBot.id);
  if (snap && snap.alive) {
    if (!origin) origin = { x: snap.x, z: snap.z };
    maxDist = Math.max(maxDist, Math.hypot(snap.x - origin.x, snap.z - origin.z));
  }
  if (maxDist > 3 && (c.botShots > 0 || c.damaged)) break;
  await sleep(100);
}
clearInterval(pump);

console.log(`bot displacement: ${maxDist.toFixed(1)}m, bot shots seen: ${c.botShots}, human damaged: ${c.damaged}, kills: ${c.kills.length}`);
if (maxDist < 3) fail('bot never moved more than 3m - navigation broken');
if (c.botShots === 0 && !c.damaged) fail('bot never fired or dealt damage - combat broken');

if (process.env.BOT_KILL_CHECK) {
  // Stronger assertion: the bot must finish off an idle target within 60s.
  const pump2 = setInterval(() => {
    c.seq++;
    ws.send(JSON.stringify({ t: 'inputs', inputs: [{ seq: c.seq, dt: 0.033, mx: 0, mz: 0, jump: false, yaw: 0, pitch: 0, fire: false, reload: false, use: false, zoom: false }] }));
  }, 50);
  const t0 = Date.now();
  while (Date.now() - t0 < 60000 && !c.kills.some((k) => k.victimId === c.id)) {
    await sleep(200);
  }
  clearInterval(pump2);
  if (!c.kills.some((k) => k.victimId === c.id)) fail('bot never killed an idle human in 60s - aim too weak');
  console.log(`ok: bot killed the idle human (after ${((Date.now() - t0) / 1000).toFixed(1)}s of round time)`);
}

console.log('\nBOT MATCH TEST PASSED');
process.exit(0);
