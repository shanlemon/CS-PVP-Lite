// Server-side bot brain. Each tick the room builds a BotSelfView/BotWorldView,
// calls think(), and feeds the returned InputFrame through the exact same
// input pipeline as human players. All randomness comes from a per-instance
// seeded PRNG so a given seed always produces the same personality/behavior.

import { EYE_HEIGHT, WEAPONS, sprayOffset } from '@cs/shared';
import type { Phase, Team, WeaponType, ItemState, InputFrame } from '@cs/shared';
import type { NavGrid, NavPoint } from './nav.js';

export const BOT_NAMES: ReadonlyArray<string> = [
  'Cliffe',
  'Hank',
  'Vitaliy',
  'Goose',
  'Minh',
  'Brett',
  'Kurt',
  'Crusher',
  'Ringo',
  'Quinn',
  'Wolf',
  'Zim',
];

export interface BotSelfView {
  id: string;
  team: Team;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  grounded: boolean;
  hp: number;
  mag: number;
  reloading: boolean;
  weapon: WeaponType;
  alive: boolean;
}

export interface BotEnemyView {
  id: string;
  x: number;
  y: number;
  z: number;
  visible: boolean; // LOS precomputed by the room (eye-to-eye raycast vs SOLIDS)
  distance: number;
}

export interface BotWorldView {
  enemies: BotEnemyView[];
  items: ItemState[];
  phase: Phase;
}

type BotFrame = Omit<InputFrame, 'seq'>;

interface EnemyMemory {
  firstSeen: number; // for the reaction timer
  lastSeen: number;
  x: number;
  y: number;
  z: number;
}

const TURN_RATE = 7; // rad/s max yaw/pitch slew
const PITCH_LIMIT = 1.45;
const FIRE_ANGLE = 0.05; // rad: only shoot when roughly on target
const FIRE_RANGE = 60;
const ERR_START = 0.06; // rad of aim error on target acquisition
const ERR_TAU = 0.6; // exponential decay time constant
const RESIGHT_GRACE = 0.6; // s out of sight before reaction timer restarts
const REPATH_INTERVAL = 1.5;
const WAYPOINT_RADIUS = 0.7;
const STUCK_WINDOW = 0.7;
const STUCK_DIST = 0.35;
const ITEM_NOTICE_RANGE = 6;
const ITEM_USE_RANGE = 1.0;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function approachAngle(cur: number, target: number, maxDelta: number): number {
  const diff = normAngle(target - cur);
  if (Math.abs(diff) <= maxDelta) return target;
  return cur + Math.sign(diff) * maxDelta;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class BotBrain {
  private readonly rng: () => number;

  // Personality (fixed per seed)
  private readonly aimSkill: number; // 0.65..1.0
  private readonly reactionTime: number; // 0.2..0.38 s
  private readonly strafePeriod: number; // s between strafe flips
  private readonly aggression: number; // 0..1
  private readonly wantsItems: boolean;

  // Clock (accumulated think dt)
  private now = 0;

  // Combat state
  private targetId: string | null = null;
  private enemyMem = new Map<string, EnemyMemory>();
  private errMag = ERR_START;
  private errDirYaw = 1;
  private errDirPitch = 0;
  private errDirAt = 0;
  private burstShots = 0;
  private burstLen = 4;
  private shotTimer = 0;
  private burstPauseUntil = 0;
  private strafeDir = 1;
  private strafeAt = 0;

  // Navigation state
  private path: NavPoint[] = [];
  private pathIdx = 0;
  private repathAt = 0;
  private goal: NavPoint | null = null;

  // Unstuck state
  private stuckCheckAt = 0;
  private lastX = 0;
  private lastZ = 0;
  private movedIntent = false;
  private unstuckUntil = 0;
  private unstuckMx = 1;
  private useCooldownUntil = 0;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
    this.aimSkill = 0.65 + this.rng() * 0.35;
    this.reactionTime = 0.2 + this.rng() * 0.18;
    this.strafePeriod = 0.55 + this.rng() * 0.65;
    this.aggression = this.rng();
    this.wantsItems = this.rng() < 1 - this.aggression * 0.55;
    this.strafeDir = this.rng() < 0.5 ? -1 : 1;
  }

  reset(): void {
    this.targetId = null;
    this.enemyMem.clear();
    this.errMag = ERR_START;
    this.errDirAt = 0;
    this.burstShots = 0;
    this.shotTimer = 0;
    this.burstPauseUntil = 0;
    this.path = [];
    this.pathIdx = 0;
    this.repathAt = 0;
    this.goal = null;
    this.stuckCheckAt = this.now + STUCK_WINDOW;
    this.movedIntent = false;
    this.unstuckUntil = 0;
    this.useCooldownUntil = 0;
  }

  think(self: BotSelfView, world: BotWorldView, nav: NavGrid, dt: number): BotFrame {
    this.now += dt;
    const frame: BotFrame = {
      dt,
      mx: 0,
      mz: 0,
      jump: false,
      yaw: self.yaw,
      pitch: self.pitch,
      fire: false,
      reload: false,
      use: false,
      zoom: false,
    };

    if (!self.alive || world.phase !== 'live') {
      if (world.phase === 'countdown' && self.alive) {
        // Slow scan while frozen, just to look less robotic.
        frame.yaw = self.yaw + Math.sin(this.now * 0.8) * 0.5 * dt;
      }
      return frame;
    }

    this.updateEnemyMemory(world);

    // Nearest visible enemy, if any.
    let target: BotEnemyView | null = null;
    for (const e of world.enemies) {
      if (e.visible && (target === null || e.distance < target.distance)) target = e;
    }

    if (target) {
      this.engage(self, target, frame, dt);
    } else {
      this.targetId = null;
      this.hunt(self, world, nav, frame, dt);
      if (!self.reloading && (self.mag === 0 || self.mag < 8)) frame.reload = true;
    }
    if (!self.reloading && self.mag === 0) frame.reload = true;

    this.updateUnstuck(self, frame);
    return frame;
  }

  // ---- ENGAGE ----

  private engage(self: BotSelfView, target: BotEnemyView, frame: BotFrame, dt: number): void {
    // Fighting interrupts navigation.
    this.path = [];
    this.goal = null;
    this.repathAt = 0;

    if (this.targetId !== target.id) {
      this.targetId = target.id;
      this.errMag = ERR_START;
      this.errDirAt = 0;
    }

    // Aim error: decays toward a skill-based floor while the target stays
    // visible; the error direction wanders slowly instead of per-tick jitter.
    const floor = 0.012 / this.aimSkill;
    this.errMag += (floor - this.errMag) * (1 - Math.exp(-dt / ERR_TAU));
    if (this.now >= this.errDirAt) {
      const a = this.rng() * Math.PI * 2;
      this.errDirYaw = Math.cos(a);
      this.errDirPitch = Math.sin(a) * 0.6;
      this.errDirAt = this.now + 0.2 + this.rng() * 0.1;
    }

    // Desired aim point: chest, or head when close and skilled.
    const headHunt = target.distance < 12 && this.aimSkill > 0.85;
    const aimY = target.y + (headHunt ? EYE_HEIGHT : 1.1);
    const dx = target.x - self.x;
    const dy = aimY - (self.y + EYE_HEIGHT);
    const dz = target.z - self.z;
    const hd = Math.hypot(dx, dz);
    const desiredYaw = Math.atan2(-dx, -dz);
    let desiredPitch = Math.atan2(dy, hd);

    // Recoil compensation while bursting: pull down ~60% of the pattern climb.
    const spec = WEAPONS[self.weapon];
    if (this.burstShots > 0) {
      desiredPitch -= 0.6 * sprayOffset(spec, this.burstShots)[1];
    }

    const wantYaw = desiredYaw + this.errDirYaw * this.errMag;
    const wantPitch = clamp(desiredPitch + this.errDirPitch * this.errMag, -PITCH_LIMIT, PITCH_LIMIT);
    frame.yaw = approachAngle(self.yaw, wantYaw, TURN_RATE * dt);
    frame.pitch = clamp(approachAngle(self.pitch, wantPitch, TURN_RATE * dt), -PITCH_LIMIT, PITCH_LIMIT);

    // Reaction gate: no firing until reactionTime after first sight.
    const mem = this.enemyMem.get(target.id);
    const reacted = mem !== undefined && this.now - mem.firstSeen >= this.reactionTime;

    const angErr = Math.hypot(normAngle(desiredYaw - frame.yaw), desiredPitch - frame.pitch);
    const canShoot =
      reacted &&
      angErr < FIRE_ANGLE &&
      target.distance < FIRE_RANGE &&
      self.mag > 0 &&
      !self.reloading &&
      this.now >= this.burstPauseUntil;

    if (canShoot) {
      frame.fire = true;
      if (this.burstShots === 0) {
        this.burstShots = 1;
        this.shotTimer = 0;
        this.burstLen = self.weapon === 'awp' ? 1 : 3 + Math.floor(this.rng() * 4);
      } else {
        this.shotTimer += dt;
        if (this.shotTimer >= spec.fireInterval) {
          this.shotTimer -= spec.fireInterval;
          this.burstShots++;
        }
      }
      if (this.burstShots >= this.burstLen) {
        // Burst done: pause so the spray pattern resets.
        this.burstPauseUntil = this.now + 0.25 + this.rng() * 0.2;
        this.burstShots = 0;
        this.shotTimer = 0;
      }
    } else {
      this.burstShots = 0;
      this.shotTimer = 0;
    }

    if (self.weapon === 'awp' && target.distance > 10) frame.zoom = true;

    // Strafe during the fight; keep a comfortable distance band.
    if (this.now >= this.strafeAt) {
      this.strafeDir = -this.strafeDir;
      this.strafeAt = this.now + this.strafePeriod * (0.7 + this.rng() * 0.6);
    }
    frame.mx = this.strafeDir;
    if (target.distance > 28 && this.aggression > 0.5) frame.mz = 1;
    else if (target.distance < 6) frame.mz = -1;
  }

  // ---- HUNT / ITEM DIVERSION ----

  private hunt(self: BotSelfView, world: BotWorldView, nav: NavGrid, frame: BotFrame, dt: number): void {
    // Item diversion: still on the default AK, no enemy in sight, ground item nearby.
    let itemGoal: { x: number; z: number } | null = null;
    if (self.weapon === 'ak47' && this.wantsItems) {
      let best = ITEM_NOTICE_RANGE;
      for (const it of world.items) {
        if (it.taken || it.y >= 0.5) continue;
        const d = Math.hypot(it.x - self.x, it.y - self.y, it.z - self.z);
        if (d < best) {
          best = d;
          itemGoal = { x: it.x, z: it.z };
        }
        if (d < ITEM_USE_RANGE && this.now >= this.useCooldownUntil) {
          frame.use = true;
          this.useCooldownUntil = this.now + 0.4;
        }
      }
    }

    if (itemGoal) {
      if (this.goal === null || Math.hypot(this.goal.x - itemGoal.x, this.goal.z - itemGoal.z) > 0.5) {
        this.goal = { x: itemGoal.x, z: itemGoal.z };
        this.repathAt = 0; // new objective: repath now
      }
    } else if (this.goal === null) {
      this.goal = this.pickHuntGoal(self, nav);
    }

    if (this.goal === null) return;

    // Repath periodically or when the current path is exhausted.
    const pathDone = this.pathIdx >= this.path.length;
    if (this.now >= this.repathAt || pathDone) {
      const nearGoal = Math.hypot(this.goal.x - self.x, this.goal.z - self.z) < 1;
      if (pathDone && nearGoal) {
        // Arrived: clear any last-seen memory here and wander next tick.
        this.consumeReachedMemory(this.goal);
        this.goal = null;
        return;
      }
      this.path = nav.findPath(self.x, self.z, this.goal.x, this.goal.z);
      this.pathIdx = 0;
      this.repathAt = this.now + REPATH_INTERVAL;
      if (this.path.length === 0) {
        this.goal = null; // unreachable: try something else next tick
        return;
      }
    }

    // Advance past waypoints we are already standing on.
    while (
      this.pathIdx < this.path.length &&
      Math.hypot(this.path[this.pathIdx].x - self.x, this.path[this.pathIdx].z - self.z) < WAYPOINT_RADIUS
    ) {
      this.pathIdx++;
    }
    if (this.pathIdx >= this.path.length) {
      // Whole (possibly snapped) path is behind us: treat the goal as reached
      // so we don't repath in place forever toward an unreachable exact point.
      this.consumeReachedMemory(this.goal);
      this.goal = null;
      return;
    }

    const wp = this.path[this.pathIdx];
    const desiredYaw = Math.atan2(-(wp.x - self.x), -(wp.z - self.z));
    frame.yaw = approachAngle(self.yaw, desiredYaw, TURN_RATE * dt);
    frame.pitch = approachAngle(self.pitch, 0, TURN_RATE * dt);

    const yawErr = normAngle(desiredYaw - frame.yaw);
    if (Math.abs(yawErr) < 1.1) {
      frame.mz = 1;
      frame.mx = clamp(-yawErr, -1, 1) * 0.6; // slight lateral correction
    }
  }

  private pickHuntGoal(self: BotSelfView, nav: NavGrid): NavPoint | null {
    // Prefer the nearest enemy's last-seen position.
    let best: NavPoint | null = null;
    let bestD = Infinity;
    for (const mem of this.enemyMem.values()) {
      const d = Math.hypot(mem.x - self.x, mem.z - self.z);
      if (d < bestD) {
        bestD = d;
        best = { x: mem.x, z: mem.z };
      }
    }
    if (best) return best;

    // Otherwise wander toward the enemy half of the map.
    const enemySign = self.team === 'T' ? -1 : 1;
    for (let i = 0; i < 12; i++) {
      const p = nav.randomWalkable();
      if (p.z * enemySign > 2) return p;
    }
    return nav.randomWalkable();
  }

  private consumeReachedMemory(goal: NavPoint): void {
    for (const [id, mem] of this.enemyMem) {
      if (Math.hypot(mem.x - goal.x, mem.z - goal.z) < 1.5) this.enemyMem.delete(id);
    }
  }

  private updateEnemyMemory(world: BotWorldView): void {
    const ids = new Set<string>();
    for (const e of world.enemies) {
      ids.add(e.id);
      if (!e.visible) continue;
      const mem = this.enemyMem.get(e.id);
      if (mem === undefined || this.now - mem.lastSeen > RESIGHT_GRACE) {
        this.enemyMem.set(e.id, { firstSeen: this.now, lastSeen: this.now, x: e.x, y: e.y, z: e.z });
      } else {
        mem.lastSeen = this.now;
        mem.x = e.x;
        mem.y = e.y;
        mem.z = e.z;
      }
    }
    // Forget enemies that left the world (died / disconnected).
    for (const id of this.enemyMem.keys()) {
      if (!ids.has(id)) this.enemyMem.delete(id);
    }
  }

  // ---- UNSTUCK ----

  private updateUnstuck(self: BotSelfView, frame: BotFrame): void {
    if (this.now < this.unstuckUntil) {
      frame.jump = true;
      frame.mx = this.unstuckMx;
      frame.mz = 1;
      return;
    }

    const wantsMove = Math.abs(frame.mx) + Math.abs(frame.mz) > 0.1;
    this.movedIntent = this.movedIntent || wantsMove;

    if (this.now >= this.stuckCheckAt) {
      const moved = Math.hypot(self.x - this.lastX, self.z - this.lastZ);
      if (this.movedIntent && moved < STUCK_DIST) {
        this.unstuckUntil = this.now + 0.5;
        this.unstuckMx = this.rng() < 0.5 ? -1 : 1;
        this.path = [];
        this.pathIdx = 0;
        this.repathAt = 0; // force a repath after the wiggle
      }
      this.lastX = self.x;
      this.lastZ = self.z;
      this.movedIntent = false;
      this.stuckCheckAt = this.now + STUCK_WINDOW;
    }
  }
}
