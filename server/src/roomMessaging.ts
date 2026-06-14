import type { ServerMsg } from '@cs/shared';
import type { WebSocket } from 'ws';

import type { SPlayer } from './player.js';
import { buildSelfSnap, buildSnapPlayers } from './roomState.js';

export function send(ws: WebSocket | null, msg: ServerMsg): void {
  if (ws !== null && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function broadcast(players: Iterable<SPlayer>, msg: ServerMsg): void {
  const data = JSON.stringify(msg);
  for (const p of players) {
    if (p.ws !== null && p.ws.readyState === p.ws.OPEN) p.ws.send(data);
  }
}

export function broadcastSnap(players: Iterable<SPlayer>, now: number): void {
  const snapshotPlayers = [...players];
  const snapPlayers = buildSnapPlayers(snapshotPlayers);
  for (const p of snapshotPlayers) {
    if (p.ws === null) continue;
    send(p.ws, { t: 'snap', time: now, players: snapPlayers, you: buildSelfSnap(p) });
  }
}
