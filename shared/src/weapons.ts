// Weapon definitions + CS2-style deterministic spray patterns.
// Patterns are cumulative [right°, up°] offsets per shot index, applied to the
// bullet direction relative to the crosshair — exactly like CS: bullets climb,
// then drift sideways, and the player compensates by pulling down/across.

export type WeaponType = 'ak47' | 'm4a4' | 'awp';

export interface WeaponSpec {
  id: WeaponType;
  name: string;
  magSize: number;
  reloadTime: number; // seconds
  fireInterval: number; // seconds between shots
  dmgBody: number;
  dmgHead: number;
  baseSpread: number; // rad, standing still
  moveSpread: number; // rad extra at full move speed
  airSpread: number; // rad extra while airborne
  sprayJitter: number; // rad of extra random jitter deep into a spray
  sprayResetTime: number; // seconds without firing before the pattern resets
  /** Cumulative [right°, up°] per shot index. Index clamps at the last entry. */
  pattern: ReadonlyArray<readonly [number, number]>;
  /** AWP-style scope. spread*Scoped replaces baseSpread while zoomed. */
  zoom: { fov: number; spreadScoped: number } | null;
}

// 30-shot AK-47 pattern: ~2 accurate shots, hard vertical climb through shot
// 9, drag left through 14, sweep right through 22, then a left-right wiggle.
const AK_PATTERN: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0.05, 0.6], [-0.08, 1.25], [0.12, 1.95], [-0.18, 2.7],
  [0.1, 3.4], [-0.32, 4.0], [0.22, 4.55], [-0.12, 5.0], [-0.75, 5.3],
  [-1.4, 5.5], [-2.0, 5.62], [-2.45, 5.68], [-2.75, 5.72], [-2.4, 5.76],
  [-1.55, 5.8], [-0.65, 5.84], [0.45, 5.87], [1.45, 5.9], [2.25, 5.92],
  [2.85, 5.94], [3.15, 5.96], [2.9, 5.98], [2.35, 6.0], [1.65, 6.0],
  [1.05, 6.0], [1.35, 6.0], [1.95, 6.0], [2.55, 6.0], [2.85, 6.0],
];

// M4: ~80% of the AK's climb, smoother, drifts right first then left.
const M4_PATTERN: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [-0.04, 0.5], [0.06, 1.0], [-0.1, 1.55], [0.12, 2.1],
  [-0.14, 2.6], [0.18, 3.1], [-0.2, 3.5], [0.1, 3.85], [0.6, 4.1],
  [1.1, 4.3], [1.6, 4.42], [2.0, 4.5], [2.25, 4.56], [1.95, 4.6],
  [1.3, 4.64], [0.55, 4.68], [-0.25, 4.72], [-1.0, 4.75], [-1.6, 4.78],
  [-2.05, 4.8], [-2.3, 4.82], [-2.1, 4.84], [-1.6, 4.86], [-1.0, 4.88],
  [-0.5, 4.9], [-0.8, 4.9], [-1.3, 4.9], [-1.8, 4.9], [-2.05, 4.9],
];

export const WEAPONS: Record<WeaponType, WeaponSpec> = {
  ak47: {
    id: 'ak47',
    name: 'AK-47',
    magSize: 30,
    reloadTime: 2.5,
    fireInterval: 0.1, // 600 RPM
    // CS2 unarmored values: 36 body (3 shots), 144 head (always a one-tap)
    dmgBody: 36,
    dmgHead: 144,
    baseSpread: 0.0015,
    moveSpread: 0.04,
    airSpread: 0.05,
    sprayJitter: 0.0009,
    sprayResetTime: 0.45,
    pattern: AK_PATTERN,
    zoom: null,
  },
  m4a4: {
    id: 'm4a4',
    name: 'M4A4',
    magSize: 30,
    reloadTime: 3.1,
    fireInterval: 0.09, // 666 RPM
    // CS2 unarmored values: 33 body, 132 head
    dmgBody: 33,
    dmgHead: 132,
    baseSpread: 0.0012,
    moveSpread: 0.032,
    airSpread: 0.045,
    sprayJitter: 0.0007,
    sprayResetTime: 0.4,
    pattern: M4_PATTERN,
    zoom: null,
  },
  awp: {
    id: 'awp',
    name: 'AWP',
    magSize: 5,
    reloadTime: 3.6,
    fireInterval: 1.45, // bolt cycle
    // CS2 values: one-shot kill to the body, comical overkill to the head
    dmgBody: 115,
    dmgHead: 448,
    baseSpread: 0.05, // unscoped: basically a prayer
    moveSpread: 0.05,
    airSpread: 0.08,
    sprayJitter: 0,
    sprayResetTime: 0,
    pattern: [[0, 0]],
    zoom: { fov: 30, spreadScoped: 0.0006 },
  },
};

export const DEFAULT_WEAPON: WeaponType = 'ak47';

const DEG2RAD = Math.PI / 180;

/**
 * Spray offset for a given shot index: [yawOffset, pitchOffset] in radians.
 * Positive pattern X means the bullet goes right (negative yaw); positive
 * pattern Y means up (positive pitch).
 */
export function sprayOffset(spec: WeaponSpec, shotIndex: number): [number, number] {
  const entry = spec.pattern[Math.min(shotIndex, spec.pattern.length - 1)];
  return [-entry[0] * DEG2RAD, entry[1] * DEG2RAD];
}

// ---- Ground weapon pickups ----

export interface ItemState {
  id: number;
  type: WeaponType;
  x: number;
  y: number;
  z: number;
  taken: boolean;
}

const CRATE_TOP_Y = 1.35;
const PLATFORM_TOP_Y = 1.0;
const PLATFORM_CRATE_TOP_Y = 2.35;

/**
 * Items placed at the start of every round. The first few preserve the pickup
 * test flow; the rest mimic aim_map's floor and crate-top rifle scatter in
 * mirrored pairs so neither team spawns closer to an upgrade.
 */
export const ITEM_SPAWNS: ReadonlyArray<{ type: WeaponType; x: number; y: number; z: number }> = [
  { type: 'm4a4', x: -9.5, y: 0, z: 0 }, // on the ground, mid-west
  { type: 'm4a4', x: 9.5, y: 0, z: 0 }, // on the ground, mid-east
  { type: 'awp', x: 0.6, y: CRATE_TOP_Y, z: 0 }, // on top of the center crate
  { type: 'awp', x: -10.9, y: CRATE_TOP_Y, z: 7.2 }, // on a crate in the T half
  { type: 'awp', x: 10.9, y: CRATE_TOP_Y, z: -7.2 }, // mirrored crate in the CT half
  { type: 'm4a4', x: -6.5, y: PLATFORM_TOP_Y, z: 21.0 },
  { type: 'm4a4', x: 6.5, y: PLATFORM_TOP_Y, z: 21.0 },
  { type: 'm4a4', x: 6.5, y: PLATFORM_TOP_Y, z: -21.0 },
  { type: 'm4a4', x: -6.5, y: PLATFORM_TOP_Y, z: -21.0 },
  { type: 'awp', x: -11.2, y: PLATFORM_CRATE_TOP_Y, z: 21.8 },
  { type: 'awp', x: 11.2, y: PLATFORM_CRATE_TOP_Y, z: -21.8 },
];

export const PICKUP_RADIUS = 1.6; // meters, horizontal distance from player feet
export const PICKUP_HEIGHT = 2.0; // meters, vertical tolerance (crate-top items grab from beside)

/**
 * Cylinder pickup check: generous horizontally, tall vertically — so an item
 * on top of a crate can be grabbed while standing next to the crate.
 */
export function canPickup(px: number, py: number, pz: number, item: { x: number; y: number; z: number }): boolean {
  return (
    Math.hypot(item.x - px, item.z - pz) <= PICKUP_RADIUS &&
    Math.abs(item.y - py) <= PICKUP_HEIGHT
  );
}
