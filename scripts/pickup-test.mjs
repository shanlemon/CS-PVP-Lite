// Verifies weapon pickup: Alice walks from T spawn to the M4 ground item,
// presses E, and we assert the weapon swap + the dropped AK appearing.
// Usage: node scripts/pickup-test.mjs   (expects the server running on :3001)
import { fail, roomName, sleep, TestClient, until } from './ws-test-client.mjs';

const ROOM = roomName('pickup');

const a = new TestClient('Alice', ROOM);
const b = new TestClient('Bob', ROOM);

await a.connect();
await b.connect();
await sleep(200);
a.join('T');
b.join('CT');
await until('teams', () => a.room?.players?.filter((p) => p.team).length === 2);
a.start();
await until('live', () => a.room.phase === 'live', 8000);
await sleep(150);

// Sanity: round starts with AK and both items on the ground.
if (a.you.weapon !== 'ak47') fail(`expected ak47 at spawn, got ${a.you.weapon}`);
const items0 = a.room.items;
if (!items0.some((i) => i.type === 'm4a4')) fail('no m4a4 item at round start');
if (!items0.some((i) => i.type === 'awp')) fail('no awp item at round start');
console.log('ok: spawned with AK; M4 and AWP present:', JSON.stringify(items0));

function nearestItem(type) {
  return a.room.items
    .filter((i) => i.type === type && !i.taken)
    .sort((p, q) =>
      Math.hypot(p.x - a.you.x, p.z - a.you.z) -
      Math.hypot(q.x - a.you.x, q.z - a.you.z)
    )[0];
}

function nearestLowItem(type) {
  return a.room.items
    .filter((i) => i.type === type && !i.taken && i.y <= 3.1)
    .sort((p, q) =>
      Math.hypot(p.x - a.you.x, p.z - a.you.z) -
      Math.hypot(q.x - a.you.x, q.z - a.you.z)
    )[0];
}

// Walk toward the nearest M4 (steering each tick toward the target).
const m4 = nearestItem('m4a4');
if (!m4) fail('no reachable m4a4 item at round start');
await (async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    const dx = m4.x - a.you.x;
    const dz = m4.z - a.you.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.7) return;
    const yaw = Math.atan2(-dx, -dz);
    a.input({ yaw, mz: 1 });
    await sleep(33);
  }
  fail(`never reached the M4 (at ${a.you.x.toFixed(1)},${a.you.z.toFixed(1)})`);
})();
console.log(`ok: reached the M4 at (${a.you.x.toFixed(2)}, ${a.you.z.toFixed(2)})`);

// Press E.
a.input({ use: true });
await until('weapon swap to m4a4', () => a.you?.weapon === 'm4a4', 3000);
if (a.you.mag !== 30) fail(`expected full M4 mag (30), got ${a.you.mag}`);
console.log('ok: now holding M4A4 with full mag');

await until(
  'dropped AK appears as item',
  () => a.room.items.some((i) => i.type === 'ak47') && !a.room.items.some((i) => i.id === m4.id),
  3000,
);
console.log('ok: picked M4 gone, dropped AK item present:', JSON.stringify(a.room.items));

// Pick the AK back up (stand on it).
a.input({ use: true });
await until('swap back to ak47', () => a.you?.weapon === 'ak47', 3000);
console.log('ok: swapped back to AK; items now:', JSON.stringify(a.room.items));

// AWP must be grabbable from beside its crate (cylinder pickup, no jumping).
const awp = nearestLowItem('awp');
if (!awp) fail('no awp item after pickup swap');
async function walkTo(tx, tz, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const dx = tx - a.you.x;
    const dz = tz - a.you.z;
    if (Math.hypot(dx, dz) < 0.4) return;
    a.input({ yaw: Math.atan2(-dx, -dz), mz: 1 });
    await sleep(33);
  }
  fail(`never reached (${tx}, ${tz}) - stuck at (${a.you.x.toFixed(1)}, ${a.you.z.toFixed(1)})`);
}

// Route toward the AWP, then stop beside its crate.
const sideZ = awp.z + (awp.z > a.you.z ? -1.4 : 1.4);
await walkTo((a.you.x + awp.x) / 2, (a.you.z + sideZ) / 2);
await walkTo(awp.x, sideZ);
a.input({ use: true });
await until('AWP picked up from beside the crate', () => a.you?.weapon === 'awp', 3000);
console.log(`ok: grabbed the AWP from beside the crate (standing at y=${a.you.y.toFixed(2)})`);

const bobSnap = a.players.find((p) => p.id === b.id);
if (bobSnap.weapon !== 'ak47') fail(`Bob's snapshot weapon wrong: ${bobSnap.weapon}`);
console.log('ok: snapshots carry weapon for all players');

console.log('\nPICKUP TEST PASSED');
a.close();
b.close();
process.exit(0);
