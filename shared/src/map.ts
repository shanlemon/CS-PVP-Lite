import type { Box, Solid, SolidKind, Team, Vec3 } from './types.js';

// aim_map arena fitted from the original CS:GO Workshop BSP (id 122443683).
// Source X maps to game X, Source Y maps to game Z, and Source Z maps to game Y.
// Floor is the y=0 plane (not a solid; handled by the simulation).

export const ARENA_HALF_X = 16; // playable width ~32m
export const ARENA_HALF_Z = 24; // playable length ~48m
export const WALL_HEIGHT = 6.7;
export const WALL_THICKNESS = 0.8;

const SPAWN_FEET_Y = 0;
const LOW_STRUCTURE_TOP_Y = 1.0;

const SOURCE_CENTER_X = 244;
const SOURCE_CENTER_Y = 284;
const SOURCE_FLOOR_Z = -16;
const SOURCE_XZ_SCALE = 40;
const SOURCE_Y_SCALE = 48;

export const PLAYER_BOUNDS = {
  minX: sourceX(-360),
  maxX: sourceX(848),
  minZ: sourceZ(-456),
  maxZ: sourceZ(1024),
} as const;

type SourceBox = readonly [number, number, number, number, number, number];

const SOURCE_CRATE_BOXES: SourceBox[] = [
  [-96, -192, -16, -56, -152, 40],
  [-176, -184, -16, -96, -104, 80],
  [-240, -144, 64, -176, -80, 128],
  [-240, -144, -16, -176, -80, 64],
  [24, -144, -16, 104, -64, 80],
  [104, -96, 64, 168, -32, 128],
  [160, -144, -16, 208, -96, 48],
  [104, -96, -16, 168, -32, 64],
  [288, -144, -16, 384, -48, 96],
  [384, -176, -16, 464, -96, 80],
  [656, 16, 32, 736, 96, 112],
  [552, -144, 32, 632, -64, 112],
  [504, -304, 32, 552, -256, 80],
  [736, 48, 32, 784, 96, 80],
  [544, 720, -16, 584, 760, 40],
  [584, 672, -16, 664, 752, 80],
  [664, 648, -16, 728, 712, 64],
  [664, 648, 64, 728, 712, 128],
  [280, 664, -16, 328, 712, 48],
  [320, 600, -16, 384, 664, 64],
  [320, 600, 64, 384, 664, 128],
  [384, 632, -16, 464, 712, 80],
  [24, 664, -16, 104, 744, 80],
  [104, 616, -16, 200, 712, 96],
  [-248, 472, 32, -168, 552, 112],
  [-296, 472, 32, -248, 520, 80],
  [-144, 632, 32, -64, 712, 112],
  [496, 1032, 160, 576, 1112, 240],
  [-136, 1032, 160, -56, 1112, 240],
  [544, -544, 160, 624, -464, 240],
  [-88, -544, 160, -8, -464, 240],
];

const SOURCE_STRUCTURAL_BOXES: SourceBox[] = [
  [-360, -648, -16, 848, -456, 160],
  [464, -456, -16, 544, -248, 32],
  [544, -456, -16, 848, -56, 32],
  [648, -56, -16, 848, 104, 32],
  [848, -680, -16, 880, 1248, 304],
  [-360, 464, -16, -160, 624, 32],
  [-360, 624, -16, -56, 1024, 32],
  [-360, 1024, -16, 848, 1216, 160],
  [-56, 816, -16, 24, 1024, 32],
  [-392, -680, 104, -360, 1248, 304],
  [-392, -680, -16, -360, 1248, 56],
  [-392, -680, 56, -376, 1248, 104],
  [-376, 344, 56, -360, 1232, 104],
  [-376, 152, 56, -360, 312, 104],
  [-376, -664, 56, -360, 120, 104],
  [-392, 1216, -16, 880, 1248, 304],
  [-392, -680, -16, 880, -648, 304],
  [744, -456, 32, 848, -352, 160],
  [760, -352, 32, 848, -264, 120],
  [680, -456, 32, 744, -392, 96],
  [-360, 920, 32, -256, 1024, 160],
  [-256, 960, 32, -192, 1024, 96],
  [-360, 832, 32, -272, 920, 120],
  [816, 480, -16, 848, 640, 304],
  [816, 144, -16, 848, 304, 304],
  [-360, 360, -16, -344, 448, 304],
  [-360, 88, 208, -344, 376, 304],
  [-360, 16, -16, -344, 104, 304],
  [-392, 1216, 304, 880, 1248, 336],
  [848, -680, 304, 880, 1248, 336],
  [-392, -680, 304, 880, -648, 336],
  [-392, -680, 304, -360, 1248, 336],
  [656, 96, 32, 848, 104, 72],
  [648, -64, 32, 656, -40, 72],
  [648, 80, 32, 656, 104, 72],
  [544, -64, 32, 648, -56, 72],
  [544, -256, 32, 552, -196, 72],
  [544, -76, 32, 552, -64, 72],
  [464, -256, 32, 544, -248, 72],
  [448, -408, -16, 464, -248, 16],
  [464, -456, 32, 472, -392, 72],
  [-264, -456, 0, -256, -248, 192],
  [-360, -456, 0, -264, -248, 160],
  [-264, -464, 160, 848, -456, 192],
  [-360, 464, 32, -168, 472, 72],
  [-168, 464, 32, -160, 500, 72],
  [-168, 612, 32, -160, 632, 72],
  [-160, 624, 32, -56, 632, 72],
  [-64, 632, 32, -56, 660, 72],
  [-64, 780, 32, -56, 824, 72],
  [-56, 816, 32, 24, 824, 72],
  [24, 816, -16, 40, 976, 16],
  [16, 960, 32, 24, 1024, 72],
  [-360, 1024, 160, 752, 1032, 192],
  [744, 816, 0, 752, 1024, 192],
  [752, 816, 0, 848, 1024, 160],
];

const SOURCE_PLATFORM_RAMP_STEPS: SourceBox[] = [
  [-160, 464, -16, -116, 624, 8],
  [-56, 624, -16, -12, 816, 8],
  [500, -456, -16, 544, -56, 8],
  [604, -56, -16, 648, 104, 8],
];

export const SPAWN_SLOTS: Record<Team, readonly Vec3[]> = {
  T: [
    { x: -4.125, y: SPAWN_FEET_Y, z: 12.5 },
    { x: -4.125, y: SPAWN_FEET_Y, z: 16.5 },
    { x: -4.125, y: SPAWN_FEET_Y, z: 14.5 },
    { x: -2.025, y: SPAWN_FEET_Y, z: 12.5 },
    { x: -2.025, y: SPAWN_FEET_Y, z: 14.5 },
    { x: -2.025, y: SPAWN_FEET_Y, z: 16.5 },
    { x: 1.775, y: SPAWN_FEET_Y, z: 12.5 },
    { x: 3.875, y: SPAWN_FEET_Y, z: 12.5 },
    { x: 1.775, y: SPAWN_FEET_Y, z: 14.5 },
    { x: 3.875, y: SPAWN_FEET_Y, z: 14.5 },
    { x: 1.775, y: SPAWN_FEET_Y, z: 16.5 },
    { x: 3.875, y: SPAWN_FEET_Y, z: 16.5 },
    { x: 9.075, y: SPAWN_FEET_Y, z: 12.9 },
    { x: 11.175, y: SPAWN_FEET_Y, z: 12.9 },
    { x: 9.075, y: SPAWN_FEET_Y, z: 14.9 },
    { x: 11.175, y: SPAWN_FEET_Y, z: 14.9 },
    { x: 9.075, y: SPAWN_FEET_Y, z: 16.9 },
    { x: 11.175, y: SPAWN_FEET_Y, z: 16.9 },
  ],
  CT: [
    { x: 4.175, y: SPAWN_FEET_Y, z: -12.5 },
    { x: 4.175, y: SPAWN_FEET_Y, z: -16.5 },
    { x: 4.175, y: SPAWN_FEET_Y, z: -14.5 },
    { x: 2.1, y: SPAWN_FEET_Y, z: -12.525 },
    { x: 2.1, y: SPAWN_FEET_Y, z: -14.525 },
    { x: 2.1, y: SPAWN_FEET_Y, z: -16.525 },
    { x: -1.825, y: SPAWN_FEET_Y, z: -12.5 },
    { x: -3.9, y: SPAWN_FEET_Y, z: -12.525 },
    { x: -1.825, y: SPAWN_FEET_Y, z: -14.6 },
    { x: -3.9, y: SPAWN_FEET_Y, z: -14.525 },
    { x: -1.825, y: SPAWN_FEET_Y, z: -16.5 },
    { x: -3.9, y: SPAWN_FEET_Y, z: -16.525 },
    { x: -9.1, y: SPAWN_FEET_Y, z: -12.925 },
    { x: -11.1, y: SPAWN_FEET_Y, z: -12.925 },
    { x: -9.1, y: SPAWN_FEET_Y, z: -14.925 },
    { x: -11.1, y: SPAWN_FEET_Y, z: -14.925 },
    { x: -9.1, y: SPAWN_FEET_Y, z: -16.925 },
    { x: -11.1, y: SPAWN_FEET_Y, z: -16.925 },
  ],
};

function sourceX(x: number): number {
  return (x - SOURCE_CENTER_X) / SOURCE_XZ_SCALE;
}

function sourceZ(y: number): number {
  return (y - SOURCE_CENTER_Y) / SOURCE_XZ_SCALE;
}

function sourceY(z: number): number {
  return (z - SOURCE_FLOOR_Z) / SOURCE_Y_SCALE;
}

function sourceBox(b: SourceBox): Box {
  const [minX, minY, minZ, maxX, maxY, maxZ] = b;
  return {
    min: { x: sourceX(minX), y: sourceY(minZ), z: sourceZ(minY) },
    max: { x: sourceX(maxX), y: sourceY(maxZ), z: sourceZ(maxY) },
  };
}

function structuralKind(b: Box): SolidKind {
  const w = b.max.x - b.min.x;
  const h = b.max.y - b.min.y;
  const d = b.max.z - b.min.z;
  const thin = Math.min(w, d) <= 0.45;
  if (b.min.y >= LOW_STRUCTURE_TOP_Y - 0.05 && h <= 0.9 && thin) return 'parapet';
  if (b.min.y <= 0.05 && h <= 0.75) return 'step';
  if (b.min.y <= 0.05 && h <= LOW_STRUCTURE_TOP_Y + 0.05) return 'platform';
  return 'wall';
}

function buildSolids(): Solid[] {
  const s: Solid[] = [];

  for (const b of SOURCE_STRUCTURAL_BOXES) {
    const bx = sourceBox(b);
    s.push({ box: bx, kind: structuralKind(bx) });
  }

  for (const b of SOURCE_PLATFORM_RAMP_STEPS) {
    s.push({ box: sourceBox(b), kind: 'step' });
  }

  for (const b of SOURCE_CRATE_BOXES) {
    s.push({ box: sourceBox(b), kind: 'crate' });
  }

  return s;
}

export const SOLIDS: Solid[] = buildSolids();

/** Spawn slots per team, facing mid. Slots are exact positions from the BSP. */
export function spawnPoint(team: Team, slot: number): { pos: Vec3; yaw: number } {
  const slots = SPAWN_SLOTS[team];
  const pos = slots[((slot % slots.length) + slots.length) % slots.length];
  const yaw = team === 'T' ? 0 : Math.PI;
  return { pos: { ...pos }, yaw };
}
