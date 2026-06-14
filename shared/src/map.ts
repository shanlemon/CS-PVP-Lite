import type { Box, Solid, SolidKind, Team, Vec3 } from './types.js';

// aim_map-style arena. +Z end is T spawn, -Z end is CT spawn.
// Floor is the y=0 plane (not a solid; handled by the simulation).

export const ARENA_HALF_X = 16; // playable width  32m
export const ARENA_HALF_Z = 24; // playable length 48m
export const WALL_HEIGHT = 5.5;
export const WALL_THICKNESS = 1;

const PLATFORM_HEIGHT = 1.0;
const PLATFORM_DEPTH = 5; // z extent of each spawn platform
const CRATE = 1.35; // single crate edge length
const LOW_WALL_HEIGHT = 0.85;
const LOW_WALL_THICKNESS = 0.45;

function box(cx: number, cz: number, w: number, h: number, d: number, y0 = 0): Box {
  return {
    min: { x: cx - w / 2, y: y0, z: cz - d / 2 },
    max: { x: cx + w / 2, y: y0 + h, z: cz + d / 2 },
  };
}

function solid(kind: SolidKind, cx: number, cz: number, w: number, h: number, d: number, y0 = 0): Solid {
  return { box: box(cx, cz, w, h, d, y0), kind };
}

function crate(cx: number, cz: number, stacked = false, w = CRATE, d = w, y0 = 0): Solid {
  return solid('crate', cx, cz, w, stacked ? CRATE * 2 : CRATE, d, y0);
}

function lowWall(cx: number, cz: number, w: number, d: number, y0: number): Solid {
  return solid('parapet', cx, cz, w, LOW_WALL_HEIGHT, d, y0);
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

  // Raised spawn platforms across each end, with stair gaps and the low front
  // parapets visible in aim_map screenshots.
  for (const sign of [1, -1] as const) {
    const platCz = sign * (hz - PLATFORM_DEPTH / 2);
    s.push(solid('platform', 0, platCz, hx * 2, PLATFORM_HEIGHT, PLATFORM_DEPTH));
    const stepCz = sign * (hz - PLATFORM_DEPTH - 0.5);
    s.push(solid('step', -7, stepCz, 4, PLATFORM_HEIGHT / 2, 1));
    s.push(solid('step', 7, stepCz, 4, PLATFORM_HEIGHT / 2, 1));

    const frontZ = sign * (hz - PLATFORM_DEPTH + LOW_WALL_THICKNESS / 2);
    s.push(lowWall(-12.7, frontZ, 5.6, LOW_WALL_THICKNESS, PLATFORM_HEIGHT));
    s.push(lowWall(12.7, frontZ, 5.6, LOW_WALL_THICKNESS, PLATFORM_HEIGHT));

    // Spawn-side crate props: large boxes on the tiled platform edges, clear of
    // the two spawn slots at x = +/-5.
    s.push(crate(-11.2, sign * (hz - 2.2), false, 1.65, 1.65, PLATFORM_HEIGHT));
    s.push(crate(11.2, sign * (hz - 2.2), false, 1.65, 1.65, PLATFORM_HEIGHT));
    s.push(crate(-14.2, sign * (hz - PLATFORM_DEPTH + 1.25), false, 1.15, 1.15, PLATFORM_HEIGHT));
    s.push(crate(14.2, sign * (hz - PLATFORM_DEPTH + 1.25), false, 1.15, 1.15, PLATFORM_HEIGHT));
  }

  // Main aim_map crate field, point-mirrored across the arena center. The
  // clusters follow the Workshop screenshots: three close-range blocks in
  // front of spawn, a staggered middle, and taller stacks off the lanes.
  const half: Array<[number, number, boolean, number, number]> = [
    // [x, z, stacked, w, d]
    // near-spawn cover row
    [-12.2, 15.1, false, 1.65, 1.65],
    [-13.8, 13.2, false, 1.1, 1.1],
    [-4.6, 14.2, false, 1.55, 1.55],
    [-2.8, 13.0, true, 1.25, 1.25],
    [2.9, 13.1, false, 1.15, 1.15],
    [11.6, 15.0, false, 1.75, 1.75],

    // staggered midfield
    [-10.9, 7.2, false, 1.45, 1.45],
    [-3.6, 6.6, true, 1.3, 1.3],
    [2.7, 5.1, false, 1.15, 1.15],
    [6.5, 8.2, false, 1.35, 1.35],
    [9.4, 9.7, true, 1.25, 1.25],
  ];
  for (const [x, z, stacked, w, d] of half) {
    s.push(crate(x, z, stacked, w, d));
    s.push(crate(-x, -z, stacked, w, d)); // point-mirrored for symmetry
  }
  // Center-line cover and the AWP-top crate used by the pickup flow.
  s.push(crate(-11.3, 0, true, 1.35, 1.35));
  s.push(crate(11.3, 0, true, 1.35, 1.35));
  s.push(crate(0.6, 0, false, CRATE, CRATE));
  s.push(crate(-0.75, 1.25, false, 1.1, 1.1)); // small L next to center single

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
