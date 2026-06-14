import type { InputFrame } from '@cs/shared';
import type { SPlayer } from './player.js';

export function enqueueInputs(player: SPlayer, inputs: InputFrame[], maxQueue: number): void {
  for (const input of inputs) {
    const newest = player.queue.length > 0 ? player.queue[player.queue.length - 1].seq : player.lastSeq;
    if (typeof input?.seq === 'number' && input.seq > newest) {
      player.queue.push(input);
    }
  }
  if (player.queue.length > maxQueue) {
    player.queue.splice(0, player.queue.length - maxQueue);
  }
}
