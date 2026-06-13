// Diagnose a single aimed shot: connect two clients, start a round, fire once,
// log every shot/hitmark/damage/kill message and the geometry involved.
import WebSocket from 'ws';

import { gamePort } from './port.mjs';

const URL = `ws://localhost:${gamePort()}/ws`;
const ROOM = 'dbg-' + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mkClient(name) {
  const c = { name, id: null, room: null, you: null, players: [], seq: 0 };
  c.ready = new Promise((resolve) => {
    c.ws = new WebSocket(URL);
    c.ws.on('open', () => {
      c.ws.send(JSON.stringify({ t: 'hello', name, avatarUrl: null, instanceId: ROOM }));
      resolve();
    });
    c.ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.t === 'welcome') { c.id = m.id; c.room = m.room; }
      else if (m.t === 'room') c.room = m.room;
      else if (m.t === 'snap') { c.you = m.you; c.players = m.players; }
      else console.log(`[${name}]`, JSON.stringify(m));
    });
  });
  c.input = (f) => c.ws.send(JSON.stringify({ t: 'inputs', inputs: [{ seq: ++c.seq, dt: 0.033, mx: 0, mz: 0, jump: false, yaw: 0, pitch: 0, fire: false, reload: false, ...f }] }));
  return c;
}

const a = mkClient('Alice');
const b = mkClient('Bob');
await a.ready; await b.ready;
await sleep(200);
a.ws.send(JSON.stringify({ t: 'team', team: 'T' }));
b.ws.send(JSON.stringify({ t: 'team', team: 'CT' }));
await sleep(200);
a.ws.send(JSON.stringify({ t: 'start' }));
await sleep(3600); // countdown 3s

console.log('phase:', a.room.phase);
console.log('alice you:', JSON.stringify(a.you));
console.log('bob in alice snap:', JSON.stringify(a.players.find((p) => p.id === b.id)));

const me = a.you;
const bob = a.players.find((p) => p.id === b.id);
const ox = me.x, oy = me.y + 1.62, oz = me.z;
const tx = bob.x, ty = bob.y + 1.1, tz = bob.z;
const dx = tx - ox, dy = ty - oy, dz = tz - oz;
const len = Math.hypot(dx, dy, dz);
const yaw = Math.atan2(-dx, -dz);
const pitch = Math.asin(dy / len);
console.log('aim:', { ox, oy, oz, tx, ty, tz, yaw, pitch, len });

for (let i = 0; i < 3; i++) {
  a.input({ yaw, pitch, fire: true });
  await sleep(50);
  a.input({ yaw, pitch, fire: false });
  await sleep(800);
}
await sleep(500);
console.log('bob hp (own snap):', JSON.stringify(b.you));
process.exit(0);
