import type { ItemState, Phase, RoomState, SelfSnap, SnapPlayer, Team } from '@cs/shared';
import type { SPlayer } from './player.js';

interface BuildRoomStateArgs {
  phase: Phase;
  scores: { T: number; CT: number };
  phaseEndsAt: number | null;
  roundWinner: Team | null;
  matchWinner: Team | null;
  players: Iterable<SPlayer>;
  items: Iterable<ItemState>;
}

export function buildRoomState(args: BuildRoomStateArgs): RoomState {
  return {
    phase: args.phase,
    scores: { ...args.scores },
    phaseEndsAt: args.phaseEndsAt,
    roundWinner: args.roundWinner,
    matchWinner: args.matchWinner,
    players: [...args.players].map((p) => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl,
      team: p.team,
      kills: p.kills,
      deaths: p.deaths,
      alive: p.alive,
      bot: p.ws === null,
    })),
    items: [...args.items].filter((item) => !item.taken),
  };
}

export function buildSnapPlayers(players: Iterable<SPlayer>): SnapPlayer[] {
  return [...players]
    .filter((p) => p.team !== null)
    .map((p) => ({
      id: p.id,
      x: p.kin.x,
      y: p.kin.y,
      z: p.kin.z,
      yaw: p.yaw,
      pitch: p.pitch,
      alive: p.alive,
      team: p.team,
      weapon: p.weapon,
    }));
}

export function buildSelfSnap(p: SPlayer): SelfSnap | null {
  if (p.team === null) return null;
  return {
    x: p.kin.x,
    y: p.kin.y,
    z: p.kin.z,
    vx: p.kin.vx,
    vy: p.kin.vy,
    vz: p.kin.vz,
    grounded: p.kin.grounded,
    hp: p.hp,
    mag: p.mag,
    reloading: p.reloadUntil !== 0,
    lastSeq: p.lastSeq,
    weapon: p.weapon,
  };
}
