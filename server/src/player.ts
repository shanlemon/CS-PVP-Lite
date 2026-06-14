import { DEFAULT_WEAPON, MAX_HP, WEAPONS } from '@cs/shared';
import type { InputFrame, KinematicState, Team, WeaponType } from '@cs/shared';
import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { BotBrain } from './bot.js';

export interface SPlayer {
  id: string;
  ws: WebSocket | null; // null = server-side bot
  brain: BotBrain | null;
  botSeq: number;
  name: string;
  avatarUrl: string | null;
  team: Team | null;
  kin: KinematicState;
  yaw: number;
  pitch: number;
  hp: number;
  alive: boolean;
  weapon: WeaponType;
  mag: number;
  reloadUntil: number; // epoch ms, 0 = not reloading
  lastFireAt: number; // epoch ms
  sprayIndex: number; // shots into the current spray pattern
  zoomed: boolean; // latest input zoom flag (AWP scope)
  kills: number;
  deaths: number;
  lastSeq: number;
  queue: InputFrame[];
  /** Damage dealt this round, keyed by victim id (for the end-of-round report). */
  dmgGiven: Map<string, { dmg: number; hits: number; killed: boolean }>;
}

function freshKinematicState(pos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }): KinematicState {
  return { x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0, vz: 0, grounded: true };
}

export function createPlayer(args: {
  ws: WebSocket | null;
  brain: BotBrain | null;
  name: string;
  avatarUrl: string | null;
  team: Team | null;
}): SPlayer {
  return {
    id: randomUUID().slice(0, 8),
    ws: args.ws,
    brain: args.brain,
    botSeq: 0,
    name: args.name,
    avatarUrl: args.avatarUrl,
    team: args.team,
    kin: freshKinematicState(),
    yaw: 0,
    pitch: 0,
    hp: MAX_HP,
    alive: false,
    weapon: DEFAULT_WEAPON,
    mag: WEAPONS[DEFAULT_WEAPON].magSize,
    reloadUntil: 0,
    lastFireAt: 0,
    sprayIndex: 0,
    zoomed: false,
    kills: 0,
    deaths: 0,
    lastSeq: 0,
    queue: [],
    dmgGiven: new Map(),
  };
}

export function resetPlayerForRound(p: SPlayer, pos: { x: number; y: number; z: number }, yaw: number): void {
  p.kin = freshKinematicState(pos);
  p.yaw = yaw;
  p.pitch = 0;
  p.hp = MAX_HP;
  p.alive = true;
  p.weapon = DEFAULT_WEAPON;
  p.mag = WEAPONS[DEFAULT_WEAPON].magSize;
  p.reloadUntil = 0;
  p.lastFireAt = 0;
  p.sprayIndex = 0;
  p.zoomed = false;
  p.dmgGiven.clear();
  if (p.brain !== null) p.brain.reset();
}
