export type Team = 'T' | 'CT';
export type Phase = 'lobby' | 'countdown' | 'live' | 'round_end' | 'match_end';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Axis-aligned box, the only collision primitive in the game. */
export interface Box {
  min: Vec3;
  max: Vec3;
}

export type SolidKind = 'wall' | 'crate' | 'platform' | 'step' | 'parapet';

export interface Solid {
  box: Box;
  kind: SolidKind;
}

/** One frame of player input. seq is monotonically increasing per client. */
export interface InputFrame {
  seq: number;
  dt: number;
  mx: number; // -1..1 strafe (+x = right)
  mz: number; // -1..1 forward (+1 = forward)
  jump: boolean;
  yaw: number;
  pitch: number;
  fire: boolean;
  reload: boolean;
  use: boolean; // one-shot: E pressed (weapon pickup)
  zoom: boolean; // scope held/toggled (AWP accuracy)
}

/** Mutable kinematic state advanced by the shared simulation. */
export interface KinematicState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
}

// ---- Network messages ----

export interface RosterEntry {
  id: string;
  name: string;
  avatarUrl: string | null;
  team: Team | null;
  kills: number;
  deaths: number;
  alive: boolean;
  bot: boolean;
}

export interface RoomState {
  phase: Phase;
  scores: { T: number; CT: number };
  players: RosterEntry[];
  /** epoch ms when the current countdown / intermission ends (if any) */
  phaseEndsAt: number | null;
  roundWinner: Team | null;
  matchWinner: Team | null;
  /** ground weapon pickups (import type from weapons.ts) */
  items: import('./weapons.js').ItemState[];
}

export interface SnapPlayer {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  alive: boolean;
  team: Team | null;
  weapon: import('./weapons.js').WeaponType;
}

export interface SelfSnap {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  hp: number;
  mag: number;
  reloading: boolean;
  lastSeq: number;
  weapon: import('./weapons.js').WeaponType;
}

export type ClientMsg =
  | { t: 'hello'; name: string; avatarUrl: string | null; instanceId: string }
  | { t: 'team'; team: Team | null }
  | { t: 'start' }
  | { t: 'again' }
  | { t: 'inputs'; inputs: InputFrame[] }
  | { t: 'addBot'; team: Team }
  | { t: 'removeBot'; id: string };

export type ServerMsg =
  | { t: 'welcome'; id: string; room: RoomState }
  | { t: 'room'; room: RoomState }
  | { t: 'snap'; time: number; players: SnapPlayer[]; you: SelfSnap | null }
  | { t: 'shot'; shooterId: string; from: Vec3; to: Vec3; weapon: import('./weapons.js').WeaponType }
  | { t: 'hitmark'; headshot: boolean }
  | { t: 'damage'; fromX: number; fromZ: number; amount: number; hp: number }
  | { t: 'kill'; killerId: string; victimId: string; headshot: boolean }
  | { t: 'damageReport'; rows: DamageReportRow[] }
  | { t: 'error'; message: string };

/** Per-victim damage summary sent to each player when a round ends. */
export interface DamageReportRow {
  name: string;
  team: Team | null;
  dmg: number;
  hits: number;
  killed: boolean;
}
