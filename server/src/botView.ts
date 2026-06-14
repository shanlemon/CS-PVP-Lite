import { EYE_HEIGHT, SOLIDS, castShot } from '@cs/shared';
import type { ItemState, Phase, Team } from '@cs/shared';
import type { BotEnemyView, BotSelfView, BotWorldView } from './botTypes.js';
import type { SPlayer } from './player.js';

export function buildBotSelfView(p: SPlayer, team: Team): BotSelfView {
  return {
    id: p.id,
    team,
    x: p.kin.x,
    y: p.kin.y,
    z: p.kin.z,
    yaw: p.yaw,
    pitch: p.pitch,
    grounded: p.kin.grounded,
    hp: p.hp,
    mag: p.mag,
    reloading: p.reloadUntil !== 0,
    weapon: p.weapon,
    alive: p.alive,
  };
}

export function buildBotWorldView(
  bot: SPlayer,
  botTeam: Team,
  players: Iterable<SPlayer>,
  items: ItemState[],
  phase: Phase,
): BotWorldView {
  const eye = { x: bot.kin.x, y: bot.kin.y + EYE_HEIGHT, z: bot.kin.z };
  const enemies: BotEnemyView[] = [];

  for (const other of players) {
    if (other === bot || !other.alive || other.team === null || other.team === botTeam) continue;
    const dx = other.kin.x - eye.x;
    const dy = other.kin.y + EYE_HEIGHT - eye.y;
    const dz = other.kin.z - eye.z;
    const distance = Math.hypot(dx, dy, dz);
    let visible = true;
    if (distance > 1e-6) {
      const dir = { x: dx / distance, y: dy / distance, z: dz / distance };
      visible = castShot(eye, dir, SOLIDS, [], distance).t >= distance - 0.1;
    }
    enemies.push({ id: other.id, x: other.kin.x, y: other.kin.y, z: other.kin.z, visible, distance });
  }

  return {
    enemies,
    items: items.filter((item) => !item.taken),
    phase,
  };
}
