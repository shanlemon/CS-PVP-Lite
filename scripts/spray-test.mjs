// Verifies the server-side CS2-style AK spray pattern.
// Alice sprays a full 30-round mag at a fixed aim point (angled away from Bob),
// we reconstruct each bullet's angular offset from the 'shot' messages and
// assert the pattern shape: vertical climb, then left drift, then right sweep.
// Usage: node scripts/spray-test.mjs   (expects the server running on :3001)
import { fail, roomName, sleep, TestClient, until } from './ws-test-client.mjs';

const ROOM = roomName('spray');

const a = new TestClient('Alice', ROOM, {
  onEvent: (msg, client) => {
    if (msg.t === 'shot' && msg.shooterId === client.id) client.shots.push(msg);
  },
});
const b = new TestClient('Bob', ROOM);
a.shots = [];

await a.connect();
await b.connect();
await sleep(200);
a.join('T');
b.join('CT');
await until('teams', () => a.room?.players?.filter((p) => p.team).length === 2);
a.start();
await until('live', () => a.room.phase === 'live', 8000);
await sleep(150);

// Aim from T spawn toward a point on the far wall well right of Bob.
const eye = { x: a.you.x, y: a.you.y + 1.62, z: a.you.z };
const tgt = { x: 2, y: eye.y, z: -24 };
const dx = tgt.x - eye.x;
const dz = tgt.z - eye.z;
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
  const vx = s.to.x - s.from.x;
  const vy = s.to.y - s.from.y;
  const vz = s.to.z - s.from.z;
  const len = Math.hypot(vx, vy, vz);
  const shotYaw = Math.atan2(-vx, -vz);
  const shotPitch = Math.asin(vy / len);
  let yawD = shotYaw - aimYaw;
  while (yawD > Math.PI) yawD -= 2 * Math.PI;
  while (yawD < -Math.PI) yawD += 2 * Math.PI;
  // pattern X is "right" = negative yaw.
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
if (!(upAt(8) - upAt(0) > 3.5)) fail(`vertical climb too weak: ${(upAt(8) - upAt(0)).toFixed(2)}deg`);
// 2. Left drift in shots 11-14 (pattern X negative).
if (!(meanRight(10, 14) < -1.0)) fail(`expected left drift in shots 11-14, got ${meanRight(10, 14).toFixed(2)}deg`);
// 3. Right sweep in shots 19-22.
if (!(meanRight(18, 22) > 1.2)) fail(`expected right sweep in shots 19-22, got ${meanRight(18, 22).toFixed(2)}deg`);
// 4. First shot is accurate.
if (!(Math.abs(offsets[0].right) < 0.5 && Math.abs(offsets[0].up) < 0.5)) fail('first shot not accurate');

console.log('\nSPRAY PATTERN OK: climb -> left drift -> right sweep, first shot accurate');
a.close();
b.close();
process.exit(0);
