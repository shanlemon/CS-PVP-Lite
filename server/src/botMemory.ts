import { RESIGHT_GRACE } from './botConfig.js';
import type { BotEnemyView, BotSelfView, BotWorldView } from './botTypes.js';
import type { NavPoint } from './nav.js';

export interface EnemyMemory {
  firstSeen: number;
  lastSeen: number;
  x: number;
  y: number;
  z: number;
}

export type EnemyMemoryMap = Map<string, EnemyMemory>;

export function updateEnemyMemory(memory: EnemyMemoryMap, world: BotWorldView, now: number): void {
  const ids = new Set<string>();
  for (const e of world.enemies) {
    ids.add(e.id);
    if (!e.visible) continue;
    rememberVisibleEnemy(memory, e, now);
  }

  for (const id of memory.keys()) {
    if (!ids.has(id)) memory.delete(id);
  }
}

export function nearestMemoryGoal(memory: EnemyMemoryMap, self: BotSelfView): NavPoint | null {
  let best: NavPoint | null = null;
  let bestD = Infinity;
  for (const mem of memory.values()) {
    const d = Math.hypot(mem.x - self.x, mem.z - self.z);
    if (d < bestD) {
      bestD = d;
      best = { x: mem.x, z: mem.z };
    }
  }
  return best;
}

export function consumeReachedMemory(memory: EnemyMemoryMap, goal: NavPoint): void {
  for (const [id, mem] of memory) {
    if (Math.hypot(mem.x - goal.x, mem.z - goal.z) < 1.5) memory.delete(id);
  }
}

function rememberVisibleEnemy(memory: EnemyMemoryMap, e: BotEnemyView, now: number): void {
  const mem = memory.get(e.id);
  if (mem === undefined || now - mem.lastSeen > RESIGHT_GRACE) {
    memory.set(e.id, { firstSeen: now, lastSeen: now, x: e.x, y: e.y, z: e.z });
    return;
  }

  mem.lastSeen = now;
  mem.x = e.x;
  mem.y = e.y;
  mem.z = e.z;
}
