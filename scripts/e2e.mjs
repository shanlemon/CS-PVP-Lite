// Headless end-to-end test of the authoritative server.
// Drives two WebSocket clients through: lobby -> teams -> start -> countdown
// -> live -> movement -> round end + score.
// Usage: node scripts/e2e.mjs   (expects the server running on :3001)
import { fail, roomName, sleep, TestClient, until } from './ws-test-client.mjs';

const ROOM = roomName('e2e');
const verbose = Boolean(process.env.E2E_VERBOSE);

const a = new TestClient('Alice', ROOM, { verbose });
const b = new TestClient('Bob', ROOM, { verbose });

await a.connect();
await b.connect();
await sleep(200);
if (!a.id || !b.id) fail('no welcome received');
console.log('ok: both clients connected, room =', ROOM);

a.join('T');
b.join('CT');
await a.wait('rosters with both teams', (m) =>
  m.t === 'room' &&
  m.room.players.some((p) => p.team === 'T') &&
  m.room.players.some((p) => p.team === 'CT')
);
console.log('ok: teams joined');

a.start();
await until('countdown', () => a.room.phase === 'countdown');
console.log('ok: countdown started');

await until('live', () => a.room.phase === 'live', 6000);
console.log('ok: round live');
await sleep(150);

if (!a.you) fail('no self snapshot');
const spawnZ = a.you.z;
if (spawnZ < 12.2 || spawnZ > 17.2) fail(`unexpected T spawn z=${spawnZ}`);
if (Math.abs(a.you.y) > 0.2) fail(`expected ground-level spawn height, y=${a.you.y}`);
console.log(`ok: spawned behind crate row at z=${spawnZ.toFixed(2)} y=${a.you.y.toFixed(2)}`);

// Walk forward (toward mid) for ~1s.
for (let i = 0; i < 30; i++) {
  a.input({ mz: 1, yaw: 0 });
  await sleep(33);
}
await sleep(150);
if (!(a.you.z < spawnZ - 0.5)) fail(`movement failed: z went ${spawnZ} -> ${a.you.z}`);
console.log(`ok: walked forward to z=${a.you.z.toFixed(2)} (y=${a.you.y.toFixed(2)})`);

// Exact aim_map cover makes spawn-to-spawn kills intentionally inconsistent.
// The combat-specific scripts cover shooting; this smoke test uses the
// authoritative forfeit path to prove round resolution still works.
b.close();
await until('forfeit round end', () => a.room.phase === 'round_end' || a.room.phase === 'lobby', 5000);
if (a.room.phase === 'lobby') {
  console.log('ok: disconnect returned room to lobby');
  console.log('\nALL E2E CHECKS PASSED');
  a.close();
  process.exit(0);
}
if (a.room.scores.T !== 1) fail(`expected T score 1, got ${JSON.stringify(a.room.scores)}`);
if (a.room.roundWinner !== 'T') fail('expected T round winner');
console.log('ok: disconnect mid-round forfeits the round (T=1)');

console.log('\nALL E2E CHECKS PASSED');
a.close();
process.exit(0);
