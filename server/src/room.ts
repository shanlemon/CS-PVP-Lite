import {
  COUNTDOWN_TIME,
  ROUNDS_TO_WIN,
  ROUND_END_TIME,
  SOLIDS,
  SPAWN_SLOTS,
  TEAM_SIZE,
  TICK_RATE,
  WEAPONS,
  simulate,
  spawnPoint,
} from '@cs/shared';
import type {
  ClientMsg,
  ItemState,
  Phase,
  RoomState,
  Team,
} from '@cs/shared';
import type { WebSocket } from 'ws';
import { BotBrain } from './bot.js';
import { BOT_NAMES } from './botConfig.js';
import { buildBotSelfView, buildBotWorldView } from './botView.js';
import { tryFire, tryReload } from './combat.js';
import { buildDamageReportRows } from './damageReport.js';
import { enqueueInputs } from './inputQueue.js';
import { createRoundItems, tryPickupItem } from './items.js';
import { NavGrid } from './nav.js';
import { createPlayer, resetPlayerForRound, type SPlayer } from './player.js';
import { broadcast, broadcastSnap, send } from './roomMessaging.js';
import { buildRoomState } from './roomState.js';

const MAX_INPUTS_PER_TICK = 10;
const MAX_QUEUE = 90;

export class Room {
  readonly instanceId: string;
  private players = new Map<string, SPlayer>();
  private wsToId = new Map<WebSocket, string>();
  private phase: Phase = 'lobby';
  private scores = { T: 0, CT: 0 };
  private phaseEndsAt: number | null = null;
  private roundWinner: Team | null = null;
  private matchWinner: Team | null = null;
  private interval: ReturnType<typeof setInterval>;
  private items: ItemState[] = [];
  private nextItemId = 0;
  private nav: NavGrid;
  private nextBotSeed = 1;

  constructor(instanceId: string, private onEmpty: () => void) {
    this.instanceId = instanceId;
    this.nav = new NavGrid();
    this.resetItems();
    this.interval = setInterval(() => this.tick(), 1000 / TICK_RATE);
  }

  // ---- connection lifecycle ----

  addPlayer(ws: WebSocket, name: string, avatarUrl: string | null): void {
    const p = createPlayer({
      ws,
      brain: null,
      name: name.slice(0, 32) || 'Player',
      avatarUrl,
      team: null,
    });
    this.players.set(p.id, p);
    this.wsToId.set(ws, p.id);
    send(ws, { t: 'welcome', id: p.id, room: this.roomState() });
    this.broadcastRoom();
  }

  removePlayer(ws: WebSocket): void {
    const id = this.wsToId.get(ws);
    if (id === undefined) return;
    this.wsToId.delete(ws);
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    if (this.phase === 'live' || this.phase === 'countdown') {
      this.checkRoundOver();
    }
    // The room lives only as long as a human is connected; bots alone don't
    // keep it (or its tick interval) alive.
    const humansLeft = [...this.players.values()].some((q) => q.ws !== null);
    if (!humansLeft) {
      clearInterval(this.interval);
      this.onEmpty();
      return;
    }
    this.broadcastRoom();
  }

  handleMessage(ws: WebSocket, msg: ClientMsg): void {
    const id = this.wsToId.get(ws);
    const p = id !== undefined ? this.players.get(id) : undefined;
    if (!p) return;
    switch (msg.t) {
      case 'team':
        this.handleTeam(p, msg.team);
        break;
      case 'start':
        this.handleStart();
        break;
      case 'again':
        this.handleAgain();
        break;
      case 'addBot':
        this.handleAddBot(msg.team);
        break;
      case 'removeBot':
        this.handleRemoveBot(msg.id);
        break;
      case 'inputs':
        if (Array.isArray(msg.inputs)) {
          enqueueInputs(p, msg.inputs, MAX_QUEUE);
        }
        break;
    }
  }

  private handleTeam(p: SPlayer, team: Team | null): void {
    if (team !== null && team !== 'T' && team !== 'CT') return;
    if (team !== null) {
      const count = this.teamPlayers(team).length;
      if (count >= TEAM_SIZE) return; // team full
    }
    p.team = team;
    if (this.phase !== 'lobby') {
      // Joined mid-match: spectate until next round spawns everyone.
      p.alive = false;
    }
    this.broadcastRoom();
  }

  // ---- bots ----

  private handleAddBot(team: Team): void {
    if (this.phase !== 'lobby') return;
    if (team !== 'T' && team !== 'CT') return;
    if (this.teamPlayers(team).length >= TEAM_SIZE) return;
    const used = new Set([...this.players.values()].map((p) => p.name));
    const free = BOT_NAMES.find((n) => !used.has(`BOT ${n}`));
    const seed = this.nextBotSeed++;
    const bot = createPlayer({
      ws: null,
      brain: new BotBrain(seed),
      name: `BOT ${free ?? `Unit-${seed}`}`,
      avatarUrl: null,
      team,
    });
    this.players.set(bot.id, bot);
    this.broadcastRoom();
  }

  private handleRemoveBot(id: string): void {
    if (this.phase !== 'lobby') return;
    const p = this.players.get(id);
    if (!p || p.ws !== null) return; // only bots can be removed
    this.players.delete(id);
    this.broadcastRoom();
  }

  /** Synthesize one InputFrame per bot per tick from its brain. */
  private thinkBots(): void {
    for (const p of this.players.values()) {
      if (p.brain === null || p.team === null) continue;
      const selfView = buildBotSelfView(p, p.team);
      const world = buildBotWorldView(p, p.team, this.players.values(), this.items, this.phase);
      const frame = p.brain.think(selfView, world, this.nav, 1 / TICK_RATE);
      p.queue.push({ ...frame, seq: ++p.botSeq });
    }
  }

  private handleStart(): void {
    if (this.phase !== 'lobby') return;
    if (this.teamPlayers('T').length === 0 || this.teamPlayers('CT').length === 0) return;
    this.scores = { T: 0, CT: 0 };
    this.matchWinner = null;
    for (const p of this.players.values()) {
      p.kills = 0;
      p.deaths = 0;
    }
    this.startRound();
  }

  private handleAgain(): void {
    if (this.phase !== 'match_end') return;
    this.phase = 'lobby';
    this.scores = { T: 0, CT: 0 };
    this.roundWinner = null;
    this.matchWinner = null;
    this.phaseEndsAt = null;
    for (const p of this.players.values()) {
      p.alive = false;
      p.kills = 0;
      p.deaths = 0;
    }
    this.broadcastRoom();
  }

  // ---- round flow ----

  private startRound(): void {
    // Don't keep cycling rounds against an empty team — wait in the lobby
    // until both sides are populated again.
    if (this.teamPlayers('T').length === 0 || this.teamPlayers('CT').length === 0) {
      this.phase = 'lobby';
      this.phaseEndsAt = null;
      this.roundWinner = null;
      this.broadcastRoom();
      return;
    }
    const now = Date.now();
    this.phase = 'countdown';
    this.phaseEndsAt = now + COUNTDOWN_TIME * 1000;
    this.roundWinner = null;
    this.resetItems();
    for (const team of ['T', 'CT'] as const) {
      const members = this.teamPlayers(team);
      const spawnSlots = this.randomSpawnSlots(team, members.length);
      members.forEach((p, slot) => {
        const sp = spawnPoint(team, spawnSlots[slot] ?? slot);
        resetPlayerForRound(p, sp.pos, sp.yaw);
      });
    }
    this.broadcastRoom();
  }

  private randomSpawnSlots(team: Team, count: number): number[] {
    const slots = SPAWN_SLOTS[team].map((_, idx) => idx);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    while (slots.length < count) slots.push(Math.floor(Math.random() * SPAWN_SLOTS[team].length));
    return slots;
  }

  /** Send each human their per-victim damage summary for the round. */
  private sendDamageReports(): void {
    for (const p of this.players.values()) {
      if (p.ws === null) continue;
      send(p.ws, { t: 'damageReport', rows: buildDamageReportRows(p, this.players) });
    }
  }

  private endRound(winner: Team): void {
    this.sendDamageReports();
    this.scores[winner]++;
    this.roundWinner = winner;
    if (this.scores[winner] >= ROUNDS_TO_WIN) {
      this.matchWinner = winner;
      this.phase = 'match_end';
      this.phaseEndsAt = null;
    } else {
      this.phase = 'round_end';
      this.phaseEndsAt = Date.now() + ROUND_END_TIME * 1000;
    }
    this.broadcastRoom();
  }

  private checkRoundOver(): void {
    if (this.phase !== 'live') return;
    const t = this.teamPlayers('T');
    const ct = this.teamPlayers('CT');
    if (t.length === 0 && ct.length === 0) {
      // Everyone left mid-round; fall back to lobby.
      this.phase = 'lobby';
      this.phaseEndsAt = null;
      this.broadcastRoom();
      return;
    }
    // A team is "down" when all members are dead — or when it has no members
    // left at all (disconnects forfeit the round).
    const tDown = !t.some((p) => p.alive);
    const ctDown = !ct.some((p) => p.alive);
    if (tDown && ctDown) this.endRound(this.roundWinner ?? 'CT'); // degenerate; shouldn't happen
    else if (tDown) this.endRound('CT');
    else if (ctDown) this.endRound('T');
  }

  // ---- items ----

  private resetItems(): void {
    this.items = createRoundItems(() => this.nextItemId++);
  }

  private tryPickup(p: SPlayer): void {
    if (!p.alive || (this.phase !== 'countdown' && this.phase !== 'live')) return;
    if (tryPickupItem(p, this.items, () => this.nextItemId++)) this.broadcastRoom();
  }

  // ---- simulation ----

  private tick(): void {
    const now = Date.now();

    // Bots queue exactly one synthesized frame per tick; the loop below then
    // simulates them through the same path as human input.
    this.thinkBots();

    for (const p of this.players.values()) {
      if (p.reloadUntil !== 0 && now >= p.reloadUntil) {
        p.reloadUntil = 0;
        p.mag = WEAPONS[p.weapon].magSize;
      }

      const frozen = this.phase !== 'live' || !p.alive;
      let processed = 0;
      while (p.queue.length > 0 && processed < MAX_INPUTS_PER_TICK) {
        const inp = p.queue.shift()!;
        processed++;
        p.yaw = inp.yaw;
        p.pitch = inp.pitch;
        p.zoomed = inp.zoom === true;
        if (p.team !== null) {
          simulate(p.kin, inp, SOLIDS, frozen);
        }
        p.lastSeq = inp.seq;
        if (!frozen) {
          if (inp.reload) tryReload(p, now);
          if (inp.fire && tryFire(p, this.players, now)) {
            this.broadcastRoom();
            this.checkRoundOver();
          }
        }
        if (inp.use === true) this.tryPickup(p);
      }
    }

    // Phase timers
    if (this.phaseEndsAt !== null && now >= this.phaseEndsAt) {
      if (this.phase === 'countdown') {
        if (this.teamPlayers('T').length === 0 || this.teamPlayers('CT').length === 0) {
          this.phase = 'lobby';
          this.phaseEndsAt = null;
          this.roundWinner = null;
        } else {
          this.phase = 'live';
          this.phaseEndsAt = null;
        }
        this.broadcastRoom();
      } else if (this.phase === 'round_end') {
        this.startRound();
      }
    }

    this.checkRoundOver();
    broadcastSnap(this.players.values(), now);
  }

  // ---- state + messaging ----

  private teamPlayers(team: Team): SPlayer[] {
    return [...this.players.values()].filter((p) => p.team === team);
  }

  private roomState(): RoomState {
    return buildRoomState({
      phase: this.phase,
      scores: this.scores,
      phaseEndsAt: this.phaseEndsAt,
      roundWinner: this.roundWinner,
      matchWinner: this.matchWinner,
      players: this.players.values(),
      items: this.items,
    });
  }

  private broadcastRoom(): void {
    broadcast(this.players.values(), { t: 'room', room: this.roomState() });
  }

}
