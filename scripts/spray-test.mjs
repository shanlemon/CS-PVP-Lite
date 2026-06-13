// Verifies the server-side CS2-style AK spray pattern.
// Alice sprays a full 30-round mag at a fixed aim point (angled away from Bob),
// we reconstruct each bullet's angular offset from the 'shot' messages and
// assert the pattern shape: vertical climb, then left drift, then right sweep.
// Usage: node scripts/spray-test.mjs   (expects the server running on :3001)
import WebSocket from 'ws';

import { gamePort } from './port.mjs';

const URL = `ws://localhost:${gamePort()}/ws`;
const ROOM = 'spray-' + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function mkClient(name) {
  const c = { name, id: null, room: null, you: null, players: [], seq: 0, shots: [] };
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
      else if (m.t === 'shot' && m.shooterId === c.id) c.shots.push(m);
    });
  });
  c.input = (f) =>
    c.ws.send(
      JSON.stringify({
        t: 'inputs',
        inputs: [
          {
            seq: ++c.seq, dt: 0.033, mx: 0, mz: 0, jump: false,
            yaw: 0, pitch: 0, fire: false, reload: false, use: false, zoom: false,
            ...f,
          },
        ],
      }),
    );
  return c;
}

async function until(desc, cond, timeoutMs = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (cond()) return;
    await sleep(50);
  }
  fail(`timeout: ${desc}`);
}

const a = mkClient('Alice');
const b = mkClient('Bob');
await a.ready;
await b.ready;
await sleep(200);
a.ws.send(JSON.stringify({ t: 'team', team: 'T' }));
b.ws.send(JSON.stringify({ t: 'team', team: 'CT' }));
await until('teams', () => a.room?.players?.filter((p) => p.team).length === 2);
a.ws.send(JSON.stringify({ t: 'start' }));
await until('live', () => a.room.phase === 'live', 8000);
await sleep(150);

// Aim from T spawn toward a point on the far wall well right of Bob.
const eye = { x: a.you.x, y: a.you.y + 1.62, z: a.you.z };
const tgt = { x: 2, y: eye.y, z: -24 };
const dx = tgt.x - eye.x, dy = 0, dz = tgt.z - eye.z;
const aimYaw = Math.atan2(-dx, -dz);
const aimPitch = 0;

// Hold the trigger: 30Hz inputs with fire=true. Generous window - input timing
// jitter makes the effective cadence a bit slower than the ideal 600rpm.
const pump = setInterval(() => a.input({ yaw: aimYaw, pitch: aimPitch, fire: true }), 33);
await until('full mag sprayed', () => a.shots.length >= 30, 6500);
clearInterval(pump);
a.input({ yaw: aimYaw, pitch: aimPitch, fire: false });
await sleep(200);

const shots = a.shots.slice(0, 30);
console.log(`recorded ${a.shots.length} shots (analyzing first 30)`);

// Reconstruct angular offsets relative to the aim direction.
const RAD2DEG = 180 / Math.PI;
const offsets = shots.map((s) => {
  const vx = s.to.x - s.from.x, vy = s.to.y - s.from.y, vz = s.to.z - s.from.z;
  const len = Math.hypot(vx, vy, vz);
  const shotYaw = Math.atan2(-vx, -vz);
  const shotPitch = Math.asin(vy / len);
  let yawD = shotYaw - aimYaw;
  while (yawD > Math.PI) yawD -= 2 * Math.PI;
  while (yawD < -Math.PI) yawD += 2 * Math.PI;
  // pattern X is "right" = negative yaw
  return { right: -yawD * RAD2DEG, up: (shotPitch - aimPitch) * RAD2DEG };
});

console.log(' #   rightdeg    updeg');
offsets.forEach((o, i) =>
  console.log(`${String(i + 1).padStart(2)}  ${o.right.toFixed(2).padStart(7)} ${o.up.toFixed(2).padStart(7)}`),
);

const upAt = (i) => offsets[i].up;
const meanRight = (from, to) =>
  offsets.slice(from, to).reduce((s, o) => s + o.right, 0) / (to - from);

// 1. Strong vertical climb across the first 9 shots.
if (!(upAt(8) - upAt(0) > 3.5)) fail(`vertical climb too weak: ${ (upAt(8) - upAt(0)).toFixed(2) }deg`);
// 2. Left drift in shots 11-14 (pattern X negative).
if (!(meanRight(10, 14) < -1.0)) fail(`expected left drift in shots 11-14, got ${meanRight(10, 14).toFixed(2)}deg`);
// 3. Right sweep in shots 19-22.
if (!(meanRight(18, 22) > 1.2)) fail(`expected right sweep in shots 19-22, got ${meanRight(18, 22).toFixed(2)}deg`);
// 4. First shot is accurate.
if (!(Math.abs(offsets[0].right) < 0.5 && Math.abs(offsets[0].up) < 0.5)) fail('first shot not accurate');

console.log('\nSPRAY PATTERN OK: climb -> left drift -> right sweep, first shot accurate');
process.exit(0);
