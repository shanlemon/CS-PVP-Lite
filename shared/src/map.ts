import type { Box, Solid, Team, Vec3 } from './types.js';

// aim_map-style arena. +Z end is T spawn, -Z end is CT spawn.
// Floor is the y=0 plane (not a solid; handled by the simulation).

export const ARENA_HALF_X = 16; // playable width  32m
export const ARENA_HALF_Z = 24; // playable length 48m
export const WALL_HEIGHT = 5.5;
export const WALL_THICKNESS = 1;

const PLATFORM_HEIGHT = 1.0;
const PLATFORM_DEPTH = 5; // z extent of each spawn platform
const CRATE = 1.2; // single crate edge length

function box(cx: number, cz: number, w: number, h: number, d: number, y0 = 0): Box {
  return {
    min: { x: cx - w / 2, y: y0, z: cz - d / 2 },
    max: { x: cx + w / 2, y: y0 + h, z: cz + d / 2 },
  };
}

function crate(cx: number, cz: number, stacked = false): Solid {
  return { box: box(cx, cz, CRATE, stacked ? CRATE * 2 : CRATE, CRATE), kind: 'crate' };
}

function buildSolids(): Solid[] {
  const s: Solid[] = [];
  const hx = ARENA_HALF_X;
  const hz = ARENA_HALF_Z;
  const t = WALL_THICKNESS;

  // Perimeter walls (centered just outside the playable bounds)
  s.push({ box: box(0, -hz - t / 2, hx * 2 + t * 2, WALL_HEIGHT, t), kind: 'wall' });
  s.push({ box: box(0, hz + t / 2, hx * 2 + t * 2, WALL_HEIGHT, t), kind: 'wall' });
  s.push({ box: box(-hx - t / 2, 0, t, WALL_HEIGHT, hz * 2 + t * 2), kind: 'wall' });
  s.push({ box: box(hx + t / 2, 0, t, WALL_HEIGHT, hz * 2 + t * 2), kind: 'wall' });

  // Raised spawn platforms across each end, with two stair steps down
  for (const sign of [1, -1] as const) {
    const platCz = sign * (hz - PLATFORM_DEPTH / 2);
    s.push({ box: box(0, platCz, hx * 2, PLATFORM_HEIGHT, PLATFORM_DEPTH), kind: 'platform' });
    const stepCz = sign * (hz - PLATFORM_DEPTH - 0.5);
    s.push({ box: box(-6, stepCz, 4, PLATFORM_HEIGHT / 2, 1), kind: 'step' });
    s.push({ box: box(6, stepCz, 4, PLATFORM_HEIGHT / 2, 1), kind: 'step' });
  }

  // Crate field — mirrored across z=0 so neither team has a cover advantage.
  // The first row sits just in front of each spawn platform so players drop
  // down behind immediate cover. The x = ±5 spawn lanes stay clear.
  const half: Array<[number, number, boolean]> = [
    // [x, z, stacked]
    // near-spawn cover row
    [-7.8, 15.8, false],
    [-2.8, 15.3, true],
    [2.2, 15.8, false],
    [7.2, 15.3, true],
    // midfield
    [-10.5, 8, false],
    [-4, 8.5, true],
    [-0.8, 4.5, false],
    [4.5, 6.5, false],
    [10.5, 9, true],
    [9, 3.5, false],
    [-13, 11, false],
  ];
  for (const [x, z, stacked] of half) {
    s.push(crate(x, z, stacked));
    s.push(crate(-x, -z, stacked)); // point-mirrored for symmetry
  }
  // Center line cover
  s.push(crate(-7, 0, true));
  s.push(crate(7, 0, true));
  s.push(crate(0.6, 0, false));
  s.push(crate(-0.6, 1.2, false)); // small L next to center single

  return s;
}

export const SOLIDS: Solid[] = buildSolids();

/** Spawn slots per team (on top of the raised platforms), facing mid. */
export function spawnPoint(team: Team, slot: number): { pos: Vec3; yaw: number } {
  const sign = team === 'T' ? 1 : -1;
  const x = slot % 2 === 0 ? -5 : 5;
  const z = sign * (ARENA_HALF_Z - 2.5);
  // yaw 0 faces -Z; T (at +Z) faces -Z => yaw 0; CT faces +Z => yaw PI
  const yaw = team === 'T' ? 0 : Math.PI;
  return { pos: { x, y: PLATFORM_HEIGHT, z }, yaw };
}
