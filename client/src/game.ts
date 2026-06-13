import * as THREE from 'three';
import {
  DEFAULT_WEAPON,
  EYE_HEIGHT,
  INPUT_SEND_INTERVAL,
  INTERP_DELAY,
  MAX_INPUT_DT,
  MOVE_SPEED,
  SOLIDS,
  WEAPONS,
  canPickup,
  simulate,
} from '@cs/shared';
import type {
  InputFrame,
  KinematicState,
  RoomState,
  SelfSnap,
  ServerMsg,
  SnapPlayer,
  Team,
  Vec3,
  WeaponType,
} from '@cs/shared';
import { playShot } from './audio.js';
import { Input } from './input.js';
import { GroundItems } from './items.js';
import { buildWorld } from './mapMesh.js';
import { Net } from './net.js';
import { RemotePlayers, type RemoteState } from './players.js';
import { Effects, Viewmodel } from './viewmodel.js';

const BASE_FOV = 80;
const SCOPE_SENSITIVITY = 0.4;
const PUNCH_DECAY = 6; // exponential decay rate, 1/s
const PUNCH_MAX = 0.11; // rad

interface SnapEntry {
  time: number;
  players: SnapPlayer[];
}

export interface GameHooks {
  onFrame(dt: number): void;
  onVitals(you: SelfSnap): void;
  onSpectate(name: string | null): void;
  onZoom(zoomed: boolean): void;
  onPickupHint(label: string | null): void;
  /** Current shot inaccuracy expressed as a crosshair gap in screen pixels. */
  onSpread(gapPx: number): void;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Game {
  myId = '';

  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private remotes: RemotePlayers;
  private effects: Effects;
  private viewmodel: Viewmodel;
  private items: GroundItems;

  private _room: RoomState | null = null;
  private selfWeapon: WeaponType = DEFAULT_WEAPON;
  private selfReloading = false;
  private zoomed = false;
  private punchPitch = 0; // visual-only recoil kick, never fed back into input
  private pickupHint: string | null = null;

  private pred: KinematicState = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true };
  private pendingInputs: InputFrame[] = [];
  private outbox: InputFrame[] = [];
  private sendTimer = 0;

  private snaps: SnapEntry[] = [];
  private timeOffset: number | null = null;
  private lastTime = performance.now();
  private orbitT = 0;
  private tmpVec = new THREE.Vector3();

  constructor(
    canvas: HTMLCanvasElement,
    private input: Input,
    private net: Net,
    private hooks: GameHooks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 300);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    buildWorld(this.scene, this.renderer);
    this.remotes = new RemotePlayers(this.scene);
    this.effects = new Effects(this.scene);
    this.viewmodel = new Viewmodel(this.camera);
    this.items = new GroundItems(this.scene);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);
    resize();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  get room(): RoomState | null {
    return this._room;
  }

  set room(next: RoomState | null) {
    this._room = next;
    if (next) this.items.sync(next.items);
  }

  cameraPosition(): { x: number; z: number } {
    return { x: this.camera.position.x, z: this.camera.position.z };
  }

  /** Debug: advance one frame manually (rAF is throttled in hidden windows). */
  debugStep(dt = 1 / 60): void {
    this.frame(dt);
  }

  /** Debug: render and capture the current view as a JPEG data URL. */
  debugCapture(width = 800): string {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = width;
    c.height = Math.round((src.height / src.width) * width);
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.75);
  }

  // ---- network events ----

  handleMessage(msg: ServerMsg): void {
    if (msg.t === 'snap') {
      this.onSnap(msg.time, msg.players, msg.you);
    } else if (msg.t === 'shot') {
      this.onShot(msg.shooterId, msg.from, msg.to, msg.weapon);
    }
  }

  private onSnap(time: number, players: SnapPlayer[], you: SelfSnap | null): void {
    this.snaps.push({ time, players });
    if (this.snaps.length > 90) this.snaps.splice(0, this.snaps.length - 90);

    const off = time - Date.now();
    this.timeOffset = this.timeOffset === null ? off : this.timeOffset * 0.9 + off * 0.1;

    if (you) {
      this.hooks.onVitals(you);
      if (you.weapon !== this.selfWeapon) {
        this.selfWeapon = you.weapon;
        this.viewmodel.setWeapon(you.weapon);
      }
      this.selfReloading = you.reloading;
      // Authoritative rewind + replay of unacknowledged inputs.
      this.pred = { x: you.x, y: you.y, z: you.z, vx: you.vx, vy: you.vy, vz: you.vz, grounded: you.grounded };
      this.pendingInputs = this.pendingInputs.filter((i) => i.seq > you.lastSeq);
      const frozen = this.isFrozen();
      for (const inp of this.pendingInputs) {
        simulate(this.pred, inp, SOLIDS, frozen);
      }
    }
  }

  private onShot(shooterId: string, from: Vec3, to: Vec3, weapon: WeaponType): void {
    if (shooterId === this.myId) {
      this.viewmodel.kick();
      this.punchPitch = Math.min(PUNCH_MAX, this.punchPitch + (weapon === 'awp' ? 0.05 : 0.013));
      const muzzle = this.viewmodel.muzzleWorld(this.tmpVec);
      this.effects.shot({ x: muzzle.x, y: muzzle.y, z: muzzle.z }, to);
      playShot(1, weapon);
    } else {
      this.effects.shot(from, to);
      const d = this.camera.position.distanceTo(new THREE.Vector3(from.x, from.y, from.z));
      playShot(Math.min(1, 14 / (4 + d)), weapon);
    }
  }

  // ---- helpers ----

  private me() {
    return this.room?.players.find((p) => p.id === this.myId) ?? null;
  }

  private isFrozen(): boolean {
    const me = this.me();
    return this.room?.phase !== 'live' || !me?.alive;
  }

  private isActive(): boolean {
    const phase = this.room?.phase;
    const me = this.me();
    return !!me?.team && (phase === 'countdown' || phase === 'live' || phase === 'round_end');
  }

  /** Interpolated remote view at render time (server time minus interp delay). */
  private interpolated(): Map<string, SnapPlayer> {
    const out = new Map<string, SnapPlayer>();
    if (this.snaps.length === 0) return out;
    const renderTime = Date.now() + (this.timeOffset ?? 0) - INTERP_DELAY * 1000;

    let i1 = this.snaps.length - 1;
    for (let i = 0; i < this.snaps.length; i++) {
      if (this.snaps[i].time >= renderTime) {
        i1 = i;
        break;
      }
    }
    const s1 = this.snaps[i1];
    const s0 = this.snaps[Math.max(0, i1 - 1)];
    const span = s1.time - s0.time;
    const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - s0.time) / span)) : 1;

    const prev = new Map(s0.players.map((p) => [p.id, p]));
    for (const p1 of s1.players) {
      const p0 = prev.get(p1.id);
      if (!p0) {
        out.set(p1.id, p1);
        continue;
      }
      out.set(p1.id, {
        ...p1,
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
        z: p0.z + (p1.z - p0.z) * t,
        yaw: lerpAngle(p0.yaw, p1.yaw, t),
        pitch: p0.pitch + (p1.pitch - p0.pitch) * t,
      });
    }
    return out;
  }

  // ---- per-frame ----

  private frame(dt: number): void {
    const me = this.me();
    const active = this.isActive();
    const aliveActive = !!(active && me?.alive);

    // Visual recoil punch decays toward zero; it never feeds back into input.pitch.
    this.punchPitch *= Math.exp(-PUNCH_DECAY * dt);
    if (this.punchPitch < 1e-4) this.punchPitch = 0;

    // Zoom state: AWP only, while alive in a live round. Dropping any of those
    // conditions clears the latch so the scope releases on death/round end/swap.
    const canZoom = this.selfWeapon === 'awp' && aliveActive && this._room?.phase === 'live';
    if (!canZoom) this.input.clearZoom();
    const zoomed = canZoom && this.input.zoomLatch;
    if (zoomed !== this.zoomed) {
      this.zoomed = zoomed;
      this.camera.fov = zoomed ? WEAPONS.awp.zoom!.fov : BASE_FOV;
      this.camera.updateProjectionMatrix();
      this.input.sensitivityScale = zoomed ? SCOPE_SENSITIVITY : 1;
      this.hooks.onZoom(zoomed);
    }

    if (active) {
      const inp = this.input.sample(Math.min(dt, MAX_INPUT_DT));
      simulate(this.pred, inp, SOLIDS, this.isFrozen());
      this.pendingInputs.push(inp);
      this.outbox.push(inp);
      this.sendTimer += dt;
      if (this.sendTimer >= INPUT_SEND_INTERVAL) {
        this.net.send({ t: 'inputs', inputs: this.outbox });
        this.outbox = [];
        this.sendTimer = 0;
      }
    }

    const interp = this.interpolated();
    let spectateId: string | null = null;
    let spectateName: string | null = null;

    if (aliveActive) {
      this.camera.position.set(this.pred.x, this.pred.y + EYE_HEIGHT, this.pred.z);
      this.camera.rotation.set(this.input.pitch + this.punchPitch, this.input.yaw, 0);
    } else if (this.room && (this.room.phase === 'live' || this.room.phase === 'countdown' || this.room.phase === 'round_end')) {
      // Dead or spectating: follow a living teammate, else any living player.
      const roster = this.room.players;
      const myTeam = me?.team ?? null;
      const candidates = roster.filter((p) => p.id !== this.myId && p.alive && p.team !== null && interp.has(p.id));
      const target =
        candidates.find((p) => myTeam !== null && p.team === myTeam) ?? candidates[0] ?? null;
      if (target) {
        const s = interp.get(target.id)!;
        this.camera.position.set(s.x, s.y + EYE_HEIGHT, s.z);
        this.camera.rotation.set(s.pitch, s.yaw, 0);
        spectateId = target.id;
        spectateName = target.name;
      }
    } else {
      // Lobby / match end: slow orbit around the arena as a backdrop.
      this.orbitT += dt * 0.1;
      this.camera.position.set(Math.sin(this.orbitT) * 26, 13, Math.cos(this.orbitT) * 26);
      this.camera.lookAt(0, 1, 0);
    }

    this.hooks.onSpectate(spectateName);

    // Remote avatars (hide self and whoever the camera is inside of)
    const roster = this.room?.players ?? [];
    const states: RemoteState[] = [];
    for (const [id, s] of interp) {
      if (id === this.myId || id === spectateId) continue;
      const entry = roster.find((p) => p.id === id);
      if (!entry || s.team === null) continue;
      states.push({
        id,
        name: entry.name,
        team: s.team as Team,
        x: s.x,
        y: s.y,
        z: s.z,
        yaw: s.yaw,
        pitch: s.pitch,
        alive: s.alive,
        weapon: s.weapon,
      });
    }
    this.remotes.sync(states);

    // Pickup hint: nearest droppable item of a different type within reach
    // (same cylinder check the server uses).
    let hint: string | null = null;
    if (aliveActive && this._room) {
      let bestD = Infinity;
      for (const item of this._room.items) {
        if (item.taken || item.type === this.selfWeapon) continue;
        if (!canPickup(this.pred.x, this.pred.y, this.pred.z, item)) continue;
        const d = Math.hypot(item.x - this.pred.x, item.z - this.pred.z);
        if (d <= bestD) {
          bestD = d;
          hint = WEAPONS[item.type].name;
        }
      }
    }
    if (hint !== this.pickupHint) {
      this.pickupHint = hint;
      this.hooks.onPickupHint(hint);
    }

    const speed = Math.hypot(this.pred.vx, this.pred.vz);

    // Crosshair spread: mirror the server's inaccuracy formula (movement +
    // airborne + a recoil bump while spraying) and project it to pixels.
    let gapPx = 0;
    if (aliveActive) {
      const spec = WEAPONS[this.selfWeapon];
      const spread =
        spec.baseSpread +
        spec.moveSpread * Math.min(1, speed / MOVE_SPEED) +
        (this.pred.grounded ? 0 : spec.airSpread) +
        spec.sprayJitter * 10 * Math.min(1, this.punchPitch / 0.06);
      const viewH = window.innerHeight || 720; // hidden windows report 0
      gapPx = (Math.tan(spread) * (viewH / 2)) / Math.tan((this.camera.fov * Math.PI) / 360);
    }
    this.hooks.onSpread(gapPx);

    this.viewmodel.group.visible = aliveActive && !this.zoomed;
    this.viewmodel.update(dt, aliveActive ? speed : 0, aliveActive && this.selfReloading);
    this.items.update(dt);
    this.effects.update(dt);

    this.renderer.render(this.scene, this.camera);
    this.hooks.onFrame(dt);
  }
}
