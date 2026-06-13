// Headless end-to-end test of the authoritative server.
// Drives two WebSocket clients through: lobby -> teams -> start -> countdown
// -> live -> movement -> aimed kills -> round end + score -> respawn.
// Usage: node scripts/e2e.mjs   (expects the server running on :3001)
import WebSocket from 'ws';

import { gamePort } from './port.mjs';

const URL = `ws://localhost:${gamePort()}/ws`;
const ROOM = 'e2e-' + Date.now();

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

class Client {
  constructor(name) {
    this.name = name;
    this.room = null;
    this.you = null;
    this.players = [];
    this.id = null;
    this.events = [];
    this.seq = 0;
    this.waiters = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(URL);
      this.ws.on('open', () => {
        this.send({ t: 'hello', name: this.name, avatarUrl: null, instanceId: ROOM });
        resolve();
      });
      this.ws.on('error', reject);
      this.ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.t === 'welcome') {
          this.id = msg.id;
          this.room = msg.room;
        } else if (msg.t === 'room') {
          this.room = msg.room;
        } else if (msg.t === 'snap') {
          this.you = msg.you;
          this.players = msg.players;
        } else {
          this.events.push(msg);
          if (process.env.E2E_VERBOSE) console.log(`  [${this.name}]`, JSON.stringify(msg));
        }
        this.waiters = this.waiters.filter((w) => !w(msg));
      });
    });
  }

  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  /** Wait until pred(msg) returns true for an incoming message. */
  wait(desc, pred, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${desc}`)), timeoutMs);
      this.waiters.push((msg) => {
        if (pred(msg)) {
          clearTimeout(timer);
          resolve(msg);
          return true;
        }
        return false;
      });
    });
  }

  input(frame) {
    this.send({
      t: 'inputs',
      inputs: [
        {
          seq: ++this.seq,
          dt: 0.033,
          mx: 0,
          mz: 0,
          jump: false,
          yaw: 0,
          pitch: 0,
          fire: false,
          reload: false,
          ...frame,
        },
      ],
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll current client state until cond() is true (avoids message races). */
async function until(desc, cond, timeoutMs = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (cond()) return;
    await sleep(50);
  }
  fail(`timeout: ${desc}`);
}

const a = new Client('Alice');
const b = new Client('Bob');

await a.connect();
await b.connect();
await sleep(200);
if (!a.id || !b.id) fail('no welcome received');
console.log('ok: both clients connected, room =', ROOM);

a.send({ t: 'team', team: 'T' });
b.send({ t: 'team', team: 'CT' });
await a.wait('rosters with both teams', (m) => m.t === 'room' && m.room.players.some((p) => p.team === 'T') && m.room.players.some((p) => p.team === 'CT'));
console.log('ok: teams joined');

a.send({ t: 'start' });
await until('countdown', () => a.room.phase === 'countdown');
console.log('ok: countdown started');

await until('live', () => a.room.phase === 'live', 6000);
console.log('ok: round live');
await sleep(150);

if (!a.you) fail('no self snapshot');
const spawnZ = a.you.z;
if (Math.abs(spawnZ - 21.5) > 0.6) fail(`unexpected T spawn z=${spawnZ}`);
if (Math.abs(a.you.y - 1.0) > 0.2) fail(`expected platform spawn height, y=${a.you.y}`);
console.log(`ok: spawned on platform at z=${spawnZ.toFixed(2)} y=${a.you.y.toFixed(2)}`);

// Walk forward (toward mid) for ~1s
for (let i = 0; i < 30; i++) {
  a.input({ mz: 1, yaw: 0 });
  await sleep(33);
}
await sleep(150);
if (!(a.you.z < spawnZ - 3)) fail(`movement failed: z went ${spawnZ} -> ${a.you.z}`);
console.log(`ok: walked forward to z=${a.you.z.toFixed(2)} (y=${a.you.y.toFixed(2)})`);

// Aim at Bob and fire single, fully-recovered shots (spread ~0 when standing).
// A real client streams inputs continuously, so the test does too: a 30Hz pump
// sends idle frames with the current aim, and the loop toggles fire briefly.
let kills = 0;
const killPromise = a.wait('kill event', (m) => m.t === 'kill' && m.killerId === a.id, 25000).then(() => {
  kills++;
});

const aim = { yaw: 0, pitch: 0, fire: false };
const pump = setInterval(() => a.input({ yaw: aim.yaw, pitch: aim.pitch, fire: aim.fire }), 33);

for (let shot = 0; shot < 10 && kills === 0; shot++) {
  const me = a.you;
  const bob = a.players.find((p) => p.id === b.id);
  if (!bob) fail('Bob not in snapshot');
  if (!bob.alive) break;
  const ox = me.x, oy = me.y + 1.62, oz = me.z;
  const tx = bob.x, ty = bob.y + 1.1, tz = bob.z; // chest
  const dx = tx - ox, dy = ty - oy, dz = tz - oz;
  const len = Math.hypot(dx, dy, dz);
  aim.yaw = Math.atan2(-dx, -dz);
  aim.pitch = Math.asin(dy / len);
  await sleep(100); // settle aim + velocity before pulling the trigger
  aim.fire = true;
  await sleep(60); // ~1 shot at 600rpm
  aim.fire = false;
  await sleep(600); // let recoil fully decay between shots
}
clearInterval(pump);

await killPromise.catch((e) => fail(e.message));
console.log('ok: Alice killed Bob with aimed shots');

await until('round end', () => a.room.phase === 'round_end', 5000);
if (a.room.scores.T !== 1) fail(`expected T score 1, got ${JSON.stringify(a.room.scores)}`);
if (a.room.roundWinner !== 'T') fail('expected T round winner');
console.log('ok: round ended, score T=1 CT=0');

// End-of-round damage report: Alice must see a row for Bob totaling 100 dmg.
await until('damage report', () => a.events.some((m) => m.t === 'damageReport'), 3000);
const report = a.events.filter((m) => m.t === 'damageReport').pop();
const bobRow = report.rows.find((r) => r.name === 'Bob');
if (!bobRow) fail(`no Bob row in damage report: ${JSON.stringify(report.rows)}`);
if (bobRow.dmg !== 100 || !bobRow.killed) fail(`expected 100 dmg + killed, got ${JSON.stringify(bobRow)}`);
console.log(`ok: damage report shows Bob: ${bobRow.dmg} dmg in ${bobRow.hits} hits, killed=${bobRow.killed}`);

await until('next round countdown', () => a.room.phase === 'countdown', 8000);
await sleep(200);
const bobEntry = a.room.players.find((p) => p.id === b.id);
if (!bobEntry.alive) fail('Bob not respawned for next round');
if (!b.you || b.you.hp !== 100) fail(`Bob hp not reset: ${b.you?.hp}`);
const bobSnap = a.players.find((p) => p.id === b.id);
if (Math.abs(bobSnap.z - -21.5) > 0.6) fail(`Bob not back at CT spawn, z=${bobSnap.z}`);
console.log('ok: both respawned at full HP for the next round');

// Disconnect mid-round: Bob leaves during the live round -> T should win the round
await until('live again', () => a.room.phase === 'live', 6000);
b.ws.close();
await until('forfeit round end', () => a.room.phase === 'round_end' || a.room.phase === 'lobby', 5000);
if (a.room.phase === 'round_end' && a.room.scores.T !== 2) fail(`expected T=2 after forfeit, got ${JSON.stringify(a.room.scores)}`);
console.log('ok: disconnect mid-round forfeits the round (T=2)');

console.log('\nALL E2E CHECKS PASSED');
a.ws.close();
process.exit(0);
