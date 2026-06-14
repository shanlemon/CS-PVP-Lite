import {
  PLAYER_BOUNDS,
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  SPAWN_SLOTS,
  SOLIDS,
} from '../shared/src/index.ts';
import { simulate } from '../shared/src/physics.ts';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function overlapsPlayer(p) {
  return SOLIDS.some((s) => {
    const b = s.box;
    return (
      p.x + PLAYER_HALF_WIDTH > b.min.x &&
      p.x - PLAYER_HALF_WIDTH < b.max.x &&
      p.y + PLAYER_HEIGHT > b.min.y &&
      p.y < b.max.y &&
      p.z + PLAYER_HALF_WIDTH > b.min.z &&
      p.z - PLAYER_HALF_WIDTH < b.max.z
    );
  });
}

function outsideBounds(p) {
  return (
    p.x < PLAYER_BOUNDS.minX - 0.01 ||
    p.x > PLAYER_BOUNDS.maxX + 0.01 ||
    p.z < PLAYER_BOUNDS.minZ - 0.01 ||
    p.z > PLAYER_BOUNDS.maxZ + 0.01
  );
}

const directions = [
  { name: '+x', yaw: -Math.PI / 2 },
  { name: '-x', yaw: Math.PI / 2 },
  { name: '+z', yaw: Math.PI },
  { name: '-z', yaw: 0 },
];

for (const [team, slots] of Object.entries(SPAWN_SLOTS)) {
  for (const [idx, spawn] of slots.entries()) {
    if (spawn.y > 0.05) fail(`${team} spawn ${idx} starts above ground at y=${spawn.y}`);
    if (overlapsPlayer(spawn)) fail(`${team} spawn ${idx} starts inside a platform/solid`);
  }
}

const rampChecks = [
  { name: 'T lower west platform', start: { x: -9, y: 0, z: 6.5 }, yaw: Math.PI / 2 },
  { name: 'T back west platform', start: { x: -6, y: 0, z: 11 }, yaw: Math.PI / 2 },
  { name: 'CT back east platform', start: { x: 6, y: 0, z: -10 }, yaw: -Math.PI / 2 },
  { name: 'CT lower east platform', start: { x: 9, y: 0, z: -6 }, yaw: -Math.PI / 2 },
];

for (const check of rampChecks) {
  const p = { ...check.start, vx: 0, vy: 0, vz: 0, grounded: true };
  for (let i = 0; i < 180; i += 1) {
    simulate(
      p,
      {
        seq: i,
        dt: 0.033,
        mx: 0,
        mz: 1,
        jump: false,
        yaw: check.yaw,
        pitch: 0,
        fire: false,
        reload: false,
        use: false,
        zoom: false,
      },
      SOLIDS,
      false,
    );
  }
  if (p.y < 0.9) fail(`${check.name} is not reachable; ended at y=${p.y.toFixed(2)}`);
}

const starts = [];
for (let x = Math.ceil(PLAYER_BOUNDS.minX); x <= Math.floor(PLAYER_BOUNDS.maxX); x += 1) {
  for (let z = Math.ceil(PLAYER_BOUNDS.minZ); z <= Math.floor(PLAYER_BOUNDS.maxZ); z += 1) {
    const p = { x, y: 0, z };
    if (!overlapsPlayer(p)) starts.push(p);
  }
}

// Regression coverage for the old edge shove: invalid/edge states must clamp
// back into the playable arena instead of resolving outside the map.
for (let x = -18; x <= 18; x += 1) {
  starts.push({ x, y: 0, z: PLAYER_BOUNDS.maxZ + 4.3 });
  starts.push({ x, y: 0, z: PLAYER_BOUNDS.minZ - 4.3 });
}
for (let z = -24; z <= 24; z += 1) {
  starts.push({ x: PLAYER_BOUNDS.maxX + 1, y: 0, z });
  starts.push({ x: PLAYER_BOUNDS.minX - 1, y: 0, z });
}

for (const start of starts) {
  for (const dir of directions) {
    const p = { ...start, vx: 0, vy: 0, vz: 0, grounded: true };
    for (let i = 0; i < 240; i += 1) {
      simulate(
        p,
        {
          seq: i,
          dt: 0.033,
          mx: 0,
          mz: 1,
          jump: false,
          yaw: dir.yaw,
          pitch: 0,
          fire: false,
          reload: false,
          use: false,
          zoom: false,
        },
        SOLIDS,
        false,
      );
    }
    if (outsideBounds(p)) {
      fail(`escaped from (${start.x}, ${start.z}) moving ${dir.name}; ended at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
    }
  }
}

console.log(`BOUNDS TEST PASSED: ${starts.length} starts stayed inside playable bounds`);
