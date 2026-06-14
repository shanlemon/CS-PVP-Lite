// Server-side bot brain. Each tick the room builds a BotSelfView/BotWorldView,
// calls think(), and feeds the returned InputFrame through the exact same
// input pipeline as human players. All randomness comes from a per-instance
// seeded PRNG so a given seed always produces the same personality/behavior.

import { EYE_HEIGHT, WEAPONS, sprayOffset } from '@cs/shared';
import type { BotEnemyView, BotFrame, BotSelfView, BotWorldView } from './botTypes.js';
import {
  ERR_START,
  ERR_TAU,
  FIRE_ANGLE,
  FIRE_RANGE,
  ITEM_NOTICE_RANGE,
  ITEM_USE_RANGE,
  PITCH_LIMIT,
  REPATH_INTERVAL,
  STUCK_DIST,
  STUCK_WINDOW,
  TURN_RATE,
  WAYPOINT_RADIUS,
} from './botConfig.js';
import { approachAngle, clamp, normAngle } from './botMath.js';
import {
  consumeReachedMemory,
  nearestMemoryGoal,
  updateEnemyMemory,
  type EnemyMemoryMap,
} from './botMemory.js';
import type { NavGrid, NavPoint } from './nav.js';
import { mulberry32 } from './random.js';

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
  private enemyMem: EnemyMemoryMap = new Map();
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

    updateEnemyMemory(this.enemyMem, world, this.now);

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
        consumeReachedMemory(this.enemyMem, this.goal);
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
      consumeReachedMemory(this.enemyMem, this.goal);
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
    const best = nearestMemoryGoal(this.enemyMem, self);
    if (best) return best;

    // Otherwise wander toward the enemy half of the map.
    const enemySign = self.team === 'T' ? -1 : 1;
    for (let i = 0; i < 12; i++) {
      const p = nav.randomWalkable();
      if (p.z * enemySign > 2) return p;
    }
    return nav.randomWalkable();
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
