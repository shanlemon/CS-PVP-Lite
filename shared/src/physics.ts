import {
  ACCEL_AIR,
  ACCEL_GROUND,
  EYE_HEIGHT,
  GRAVITY,
  HEAD_RADIUS,
  JUMP_VELOCITY,
  MAX_INPUT_DT,
  MOVE_SPEED,
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  STEP_HEIGHT,
} from './constants.js';
import type { Box, InputFrame, KinematicState, Solid, Vec3 } from './types.js';

const EPS = 1e-4;

function overlapsBox(x: number, y: number, z: number, b: Box): boolean {
  return (
    x + PLAYER_HALF_WIDTH > b.min.x &&
    x - PLAYER_HALF_WIDTH < b.max.x &&
    y + PLAYER_HEIGHT > b.min.y &&
    y < b.max.y &&
    z + PLAYER_HALF_WIDTH > b.min.z &&
    z - PLAYER_HALF_WIDTH < b.max.z
  );
}

function collidesAny(x: number, y: number, z: number, solids: Solid[]): boolean {
  for (const s of solids) {
    if (overlapsBox(x, y, z, s.box)) return true;
  }
  return false;
}

function approach(cur: number, target: number, delta: number): number {
  if (cur < target) return Math.min(cur + delta, target);
  return Math.max(cur - delta, target);
}

/**
 * Advance one input frame. Deterministic: the client runs this for prediction,
 * the server runs it as the authority. `frozen` disables movement intent
 * (countdown/intermission) but still applies gravity so state stays consistent.
 */
export function simulate(p: KinematicState, inp: InputFrame, solids: Solid[], frozen: boolean): void {
  const dt = Math.min(Math.max(inp.dt, 0), MAX_INPUT_DT);
  if (dt <= 0) return;

  // Wish velocity from yaw + move axes. yaw=0 faces -Z.
  let wx = 0;
  let wz = 0;
  if (!frozen) {
    const sin = Math.sin(inp.yaw);
    const cos = Math.cos(inp.yaw);
    const fx = -sin;
    const fz = -cos;
    const rx = cos;
    const rz = -sin;
    wx = fx * inp.mz + rx * inp.mx;
    wz = fz * inp.mz + rz * inp.mx;
    const len = Math.hypot(wx, wz);
    if (len > 1) {
      wx /= len;
      wz /= len;
    }
    wx *= MOVE_SPEED;
    wz *= MOVE_SPEED;
  }

  const accel = p.grounded ? ACCEL_GROUND : ACCEL_AIR;
  p.vx = approach(p.vx, wx, accel * dt);
  p.vz = approach(p.vz, wz, accel * dt);

  if (!frozen && inp.jump && p.grounded) {
    p.vy = JUMP_VELOCITY;
    p.grounded = false;
  }
  p.vy -= GRAVITY * dt;

  moveAxis(p, solids, p.vx * dt, 'x');
  moveAxis(p, solids, p.vz * dt, 'z');
  moveVertical(p, solids, p.vy * dt);
}

function moveAxis(p: KinematicState, solids: Solid[], delta: number, axis: 'x' | 'z'): void {
  if (delta === 0) return;
  const next = (axis === 'x' ? p.x : p.z) + delta;
  const nx = axis === 'x' ? next : p.x;
  const nz = axis === 'z' ? next : p.z;

  if (!collidesAny(nx, p.y, nz, solids)) {
    if (axis === 'x') p.x = nx;
    else p.z = nz;
    return;
  }

  // Try stepping up onto low obstacles (stairs, single crates are too tall).
  if (p.grounded) {
    let stepTop = -1;
    for (const s of solids) {
      if (overlapsBox(nx, p.y, nz, s.box)) {
        stepTop = Math.max(stepTop, s.box.max.y);
      }
    }
    const lift = stepTop - p.y;
    if (lift > 0 && lift <= STEP_HEIGHT && !collidesAny(nx, stepTop + EPS, nz, solids)) {
      p.y = stepTop + EPS;
      if (axis === 'x') p.x = nx;
      else p.z = nz;
      return;
    }
  }

  // Blocked: clamp to the nearest face so we slide along walls cleanly.
  let pos = next;
  for (const s of solids) {
    const b = s.box;
    if (!overlapsBox(axis === 'x' ? pos : p.x, p.y, axis === 'z' ? pos : p.z, b)) continue;
    if (axis === 'x') {
      pos = delta > 0 ? b.min.x - PLAYER_HALF_WIDTH - EPS : b.max.x + PLAYER_HALF_WIDTH + EPS;
    } else {
      pos = delta > 0 ? b.min.z - PLAYER_HALF_WIDTH - EPS : b.max.z + PLAYER_HALF_WIDTH + EPS;
    }
  }
  if (axis === 'x') {
    p.x = pos;
    p.vx = 0;
  } else {
    p.z = pos;
    p.vz = 0;
  }
}

function moveVertical(p: KinematicState, solids: Solid[], delta: number): void {
  p.y += delta;
  p.grounded = false;

  if (p.y <= 0) {
    p.y = 0;
    if (p.vy < 0) p.vy = 0;
    p.grounded = true;
  }

  for (const s of solids) {
    const b = s.box;
    if (!overlapsBox(p.x, p.y, p.z, b)) continue;
    if (delta <= 0) {
      // Landing on top
      p.y = b.max.y + EPS;
      if (p.vy < 0) p.vy = 0;
      p.grounded = true;
    } else {
      // Bonking a ceiling/underside
      p.y = b.min.y - PLAYER_HEIGHT - EPS;
      if (p.vy > 0) p.vy = 0;
    }
  }
}

// ---- Raycasting (hitscan) ----

export function rayBox(o: Vec3, d: Vec3, b: Box): number | null {
  let tmin = 0;
  let tmax = Infinity;
  const oArr = [o.x, o.y, o.z];
  const dArr = [d.x, d.y, d.z];
  const minArr = [b.min.x, b.min.y, b.min.z];
  const maxArr = [b.max.x, b.max.y, b.max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dArr[i]) < 1e-9) {
      if (oArr[i] < minArr[i] || oArr[i] > maxArr[i]) return null;
    } else {
      const inv = 1 / dArr[i];
      let t1 = (minArr[i] - oArr[i]) * inv;
      let t2 = (maxArr[i] - oArr[i]) * inv;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export function raySphere(o: Vec3, d: Vec3, c: Vec3, r: number): number | null {
  const lx = c.x - o.x;
  const ly = c.y - o.y;
  const lz = c.z - o.z;
  const tca = lx * d.x + ly * d.y + lz * d.z;
  if (tca < 0) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return null;
  const thc = Math.sqrt(r2 - d2);
  const t = tca - thc;
  return t >= 0 ? t : null;
}

export interface ShotTarget {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface ShotResult {
  t: number;
  point: Vec3;
  playerId: string | null;
  headshot: boolean;
}

/** Cast a hitscan ray against world solids and player hitboxes. */
export function castShot(origin: Vec3, dir: Vec3, solids: Solid[], targets: ShotTarget[], maxRange: number): ShotResult {
  let bestT = maxRange;
  let playerId: string | null = null;
  let headshot = false;

  for (const s of solids) {
    const t = rayBox(origin, dir, s.box);
    if (t !== null && t < bestT) {
      bestT = t;
      playerId = null;
      headshot = false;
    }
  }

  for (const tgt of targets) {
    const bodyBox: Box = {
      min: { x: tgt.x - PLAYER_HALF_WIDTH, y: tgt.y, z: tgt.z - PLAYER_HALF_WIDTH },
      max: { x: tgt.x + PLAYER_HALF_WIDTH, y: tgt.y + PLAYER_HEIGHT, z: tgt.z + PLAYER_HALF_WIDTH },
    };
    const tBody = rayBox(origin, dir, bodyBox);
    const headCenter: Vec3 = { x: tgt.x, y: tgt.y + EYE_HEIGHT, z: tgt.z };
    const tHead = raySphere(origin, dir, headCenter, HEAD_RADIUS);

    let t: number | null = null;
    let isHead = false;
    if (tHead !== null && (tBody === null || tHead <= tBody + 0.05)) {
      t = tHead;
      isHead = true;
    } else if (tBody !== null) {
      t = tBody;
    }
    if (t !== null && t < bestT) {
      bestT = t;
      playerId = tgt.id;
      headshot = isHead;
    }
  }

  return {
    t: bestT,
    point: { x: origin.x + dir.x * bestT, y: origin.y + dir.y * bestT, z: origin.z + dir.z * bestT },
    playerId,
    headshot,
  };
}

/** View direction from yaw/pitch. yaw=0,pitch=0 faces -Z; positive pitch looks up. */
export function viewDir(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}
