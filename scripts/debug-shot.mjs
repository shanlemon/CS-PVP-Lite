// Diagnose a single aimed shot: connect two clients, start a round, fire once,
// log every shot/hitmark/damage/kill message and the geometry involved.
import { sleep, TestClient } from './ws-test-client.mjs';

const ROOM = 'dbg-' + Date.now();

const a = new TestClient('Alice', ROOM, { verbose: true });
const b = new TestClient('Bob', ROOM, { verbose: true });
await Promise.all([a.connect(), b.connect()]);
await sleep(200);
a.join('T');
b.join('CT');
await sleep(200);
a.start();
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
