import type { DamageReportRow } from '@cs/shared';
import type { SPlayer } from './player.js';

export function buildDamageReportRows(
  player: SPlayer,
  playersById: ReadonlyMap<string, SPlayer>,
): DamageReportRow[] {
  const rows = [...player.dmgGiven.entries()].map(([victimId, entry]) => {
    const victim = playersById.get(victimId);
    return {
      name: victim?.name ?? 'Disconnected',
      team: victim?.team ?? null,
      dmg: entry.dmg,
      hits: entry.hits,
      killed: entry.killed,
    };
  });
  rows.sort((a, b) => b.dmg - a.dmg);
  return rows;
}
