import { INTERP_DELAY } from '@cs/shared';
import type { SnapPlayer } from '@cs/shared';

export interface SnapEntry {
  time: number;
  players: SnapPlayer[];
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function interpolatedPlayers(
  snaps: readonly SnapEntry[],
  timeOffset: number | null,
  now = Date.now(),
): Map<string, SnapPlayer> {
  const out = new Map<string, SnapPlayer>();
  if (snaps.length === 0) return out;
  const renderTime = now + (timeOffset ?? 0) - INTERP_DELAY * 1000;

  let i1 = snaps.length - 1;
  for (let i = 0; i < snaps.length; i++) {
    if (snaps[i].time >= renderTime) {
      i1 = i;
      break;
    }
  }
  const s1 = snaps[i1];
  const s0 = snaps[Math.max(0, i1 - 1)];
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
