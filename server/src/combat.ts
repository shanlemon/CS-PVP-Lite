import {
  EYE_HEIGHT,
  MOVE_SPEED,
  SHOT_RANGE,
  SOLIDS,
  WEAPONS,
  castShot,
  sprayOffset,
  viewDir,
} from '@cs/shared';

import type { SPlayer } from './player.js';
import { broadcast, send } from './roomMessaging.js';

export function tryReload(p: SPlayer, now: number): void {
  const spec = WEAPONS[p.weapon];
  if (p.reloadUntil !== 0 || p.mag >= spec.magSize) return;
  p.reloadUntil = now + spec.reloadTime * 1000;
  p.sprayIndex = 0;
}

export function tryFire(p: SPlayer, players: Map<string, SPlayer>, now: number): boolean {
  const spec = WEAPONS[p.weapon];
  if (now - p.lastFireAt < spec.fireInterval * 1000) return false;
  if (p.reloadUntil !== 0) return false;
  if (p.mag <= 0) {
    tryReload(p, now);
    return false;
  }

  if (now - p.lastFireAt > spec.sprayResetTime * 1000) p.sprayIndex = 0;
  const [yawOff, pitchOff] = sprayOffset(spec, p.sprayIndex);
  p.sprayIndex++;
  p.lastFireAt = now;
  p.mag--;

  const speed = Math.hypot(p.kin.vx, p.kin.vz);
  let inacc =
    spec.zoom !== null
      ? p.zoomed
        ? spec.zoom.spreadScoped
        : spec.baseSpread
      : spec.baseSpread + spec.sprayJitter * Math.min(p.sprayIndex, 10);
  inacc +=
    spec.moveSpread * Math.min(1, speed / MOVE_SPEED) +
    (p.kin.grounded ? 0 : spec.airSpread);

  const yaw = p.yaw + (Math.random() - 0.5) * 2 * inacc + yawOff;
  const pitch = p.pitch + (Math.random() - 0.5) * 2 * inacc + pitchOff;
  const dir = viewDir(yaw, pitch);
  const origin = { x: p.kin.x, y: p.kin.y + EYE_HEIGHT, z: p.kin.z };

  const targets = [...players.values()]
    .filter((o) => o !== p && o.alive && o.team !== null && o.team !== p.team)
    .map((o) => ({ id: o.id, x: o.kin.x, y: o.kin.y, z: o.kin.z }));

  const result = castShot(origin, dir, SOLIDS, targets, SHOT_RANGE);
  broadcast(players.values(), { t: 'shot', shooterId: p.id, from: origin, to: result.point, weapon: p.weapon });

  if (result.playerId === null) return false;

  const victim = players.get(result.playerId);
  if (!victim || !victim.alive) return false;

  const dmg = result.headshot ? spec.dmgHead : spec.dmgBody;
  const dealt = Math.min(dmg, victim.hp);
  const entry = p.dmgGiven.get(victim.id) ?? { dmg: 0, hits: 0, killed: false };
  entry.dmg += dealt;
  entry.hits++;
  victim.hp = Math.max(0, victim.hp - dmg);
  if (victim.hp <= 0) entry.killed = true;
  p.dmgGiven.set(victim.id, entry);

  send(p.ws, { t: 'hitmark', headshot: result.headshot });
  send(victim.ws, {
    t: 'damage',
    fromX: p.kin.x,
    fromZ: p.kin.z,
    amount: dmg,
    hp: victim.hp,
  });

  if (victim.hp > 0) return false;

  victim.alive = false;
  victim.deaths++;
  p.kills++;
  broadcast(players.values(), { t: 'kill', killerId: p.id, victimId: victim.id, headshot: result.headshot });
  return true;
}
