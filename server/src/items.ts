import { ITEM_SPAWNS, WEAPONS, canPickup } from '@cs/shared';
import type { ItemState } from '@cs/shared';
import type { SPlayer } from './player.js';

type NextItemId = () => number;

export function createRoundItems(nextItemId: NextItemId): ItemState[] {
  return ITEM_SPAWNS.map((s) => ({
    id: nextItemId(),
    type: s.type,
    x: s.x,
    y: s.y,
    z: s.z,
    taken: false,
  }));
}

export function tryPickupItem(p: SPlayer, items: ItemState[], nextItemId: NextItemId): boolean {
  let best: ItemState | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    if (item.taken || item.type === p.weapon) continue;
    if (!canPickup(p.kin.x, p.kin.y, p.kin.z, item)) continue;
    const d = Math.hypot(item.x - p.kin.x, item.z - p.kin.z);
    if (d <= bestDist) {
      bestDist = d;
      best = item;
    }
  }
  if (best === null) return false;

  best.taken = true;
  items.push({
    id: nextItemId(),
    type: p.weapon,
    x: p.kin.x,
    y: p.kin.grounded ? p.kin.y : 0,
    z: p.kin.z,
    taken: false,
  });
  p.weapon = best.type;
  p.mag = WEAPONS[best.type].magSize;
  p.reloadUntil = 0;
  p.sprayIndex = 0;
  p.lastFireAt = 0;
  return true;
}
