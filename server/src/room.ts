import {
  COUNTDOWN_TIME,
  DEFAULT_WEAPON,
  EYE_HEIGHT,
  ITEM_SPAWNS,
  MAX_HP,
  MOVE_SPEED,
  ROUNDS_TO_WIN,
  ROUND_END_TIME,
  SHOT_RANGE,
  SOLIDS,
  TEAM_SIZE,
  TICK_RATE,
  WEAPONS,
  canPickup,
  castShot,
  simulate,
  spawnPoint,
  sprayOffset,
  viewDir,
} from '@cs/shared';
import type {
  ClientMsg,
  InputFrame,
  ItemState,
  KinematicState,
  Phase,
  RoomState,
  ServerMsg,
  SnapPlayer,
  Team,
  WeaponType,
} from '@cs/shared';
import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import { BOT_NAMES, BotBrain } from './bot.js';
import type { BotEnemyView, BotSelfView, BotWorldView } from './bot.js';
import { NavGrid } from './nav.js';

const MAX_INPUTS_PER_TICK = 10;
const MAX_QUEUE = 90;

interface SPlayer {
  id: string;
  ws: WebSocket | null; // null = server-side bot
  brain: BotBrain | null;
  botSeq: number;
  name: string;
  avatarUrl: string | null;
  team: Team | null;
  kin: KinematicState;
  yaw: number;
  pitch: number;
  hp: number;
  alive: boolean;
  weapon: WeaponType;
  mag: number;
  reloadUntil: number; // epoch ms, 0 = not reloading
  lastFireAt: number; // epoch ms
  sprayIndex: number; // shots into the current spray pattern
  zoomed: boolean; // latest input zoom flag (AWP scope)
  kills: number;
  deaths: number;
  lastSeq: number;
  queue: InputFrame[];
  /** Damage dealt this round, keyed by victim id (for the end-of-round report). */
  dmgGiven: Map<string, { dmg: number; hits: number; killed: boolean }>;
}

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
    const p: SPlayer = {
      id: randomUUID().slice(0, 8),
      ws,
      brain: null,
      botSeq: 0,
      name: name.slice(0, 32) || 'Player',
      avatarUrl,
      team: null,
      kin: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true },
      yaw: 0,
      pitch: 0,
      hp: MAX_HP,
      alive: false,
      weapon: DEFAULT_WEAPON,
      mag: WEAPONS[DEFAULT_WEAPON].magSize,
      reloadUntil: 0,
      lastFireAt: 0,
      sprayIndex: 0,
      zoomed: false,
      kills: 0,
      deaths: 0,
      lastSeq: 0,
      queue: [],
      dmgGiven: new Map(),
    };
    this.players.set(p.id, p);
    this.wsToId.set(ws, p.id);
    this.send(ws, { t: 'welcome', id: p.id, room: this.roomState() });
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
          for (const inp of msg.inputs) {
            const newest = p.queue.length > 0 ? p.queue[p.queue.length - 1].seq : p.lastSeq;
            if (typeof inp?.seq === 'number' && inp.seq > newest) {
              p.queue.push(inp);
            }
          }
          if (p.queue.length > MAX_QUEUE) p.queue.splice(0, p.queue.length - MAX_QUEUE);
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
    const bot: SPlayer = {
      id: randomUUID().slice(0, 8),
      ws: null,
      brain: new BotBrain(seed),
      botSeq: 0,
      name: `BOT ${free ?? `Unit-${seed}`}`,
      avatarUrl: null,
      team,
      kin: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true },
      yaw: 0,
      pitch: 0,
      hp: MAX_HP,
      alive: false,
      weapon: DEFAULT_WEAPON,
      mag: WEAPONS[DEFAULT_WEAPON].magSize,
      reloadUntil: 0,
      lastFireAt: 0,
      sprayIndex: 0,
      zoomed: false,
      kills: 0,
      deaths: 0,
      lastSeq: 0,
      queue: [],
      dmgGiven: new Map(),
    };
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
      const selfView: BotSelfView = {
        id: p.id,
        team: p.team,
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
      const eye = { x: p.kin.x, y: p.kin.y + EYE_HEIGHT, z: p.kin.z };
      const enemies: BotEnemyView[] = [];
      for (const o of this.players.values()) {
        if (o === p || !o.alive || o.team === null || o.team === p.team) continue;
        const dx = o.kin.x - eye.x;
        const dy = o.kin.y + EYE_HEIGHT - eye.y;
        const dz = o.kin.z - eye.z;
        const distance = Math.hypot(dx, dy, dz);
        let visible = true;
        if (distance > 1e-6) {
          const dir = { x: dx / distance, y: dy / distance, z: dz / distance };
          // LOS: ray vs world solids only; unobstructed when it travels the
          // full eye-to-eye distance.
          visible = castShot(eye, dir, SOLIDS, [], distance).t >= distance - 0.1;
        }
        enemies.push({ id: o.id, x: o.kin.x, y: o.kin.y, z: o.kin.z, visible, distance });
      }
      const world: BotWorldView = {
        enemies,
        items: this.items.filter((i) => !i.taken),
        phase: this.phase,
      };
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
      members.forEach((p, slot) => {
        const sp = spawnPoint(team, slot);
        p.kin = { x: sp.pos.x, y: sp.pos.y, z: sp.pos.z, vx: 0, vy: 0, vz: 0, grounded: true };
        p.yaw = sp.yaw;
        p.pitch = 0;
        p.hp = MAX_HP;
        p.alive = true;
        p.weapon = DEFAULT_WEAPON;
        p.mag = WEAPONS[DEFAULT_WEAPON].magSize;
        p.reloadUntil = 0;
        p.lastFireAt = 0;
        p.sprayIndex = 0;
        p.zoomed = false;
        p.dmgGiven.clear();
        if (p.brain !== null) p.brain.reset();
      });
    }
    this.broadcastRoom();
  }

  /** Send each human their per-victim damage summary for the round. */
  private sendDamageReports(): void {
    for (const p of this.players.values()) {
      if (p.ws === null) continue;
      const rows = [...p.dmgGiven.entries()].map(([victimId, e]) => {
        const victim = this.players.get(victimId);
        return {
          name: victim?.name ?? 'Disconnected',
          team: victim?.team ?? null,
          dmg: e.dmg,
          hits: e.hits,
          killed: e.killed,
        };
      });
      rows.sort((a, b) => b.dmg - a.dmg);
      this.send(p.ws, { t: 'damageReport', rows });
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
    this.items = ITEM_SPAWNS.map((s) => ({
      id: this.nextItemId++,
      type: s.type,
      x: s.x,
      y: s.y,
      z: s.z,
      taken: false,
    }));
  }

  private tryPickup(p: SPlayer): void {
    if (!p.alive || (this.phase !== 'countdown' && this.phase !== 'live')) return;
    let best: ItemState | null = null;
    let bestDist = Infinity;
    for (const item of this.items) {
      if (item.taken || item.type === p.weapon) continue;
      if (!canPickup(p.kin.x, p.kin.y, p.kin.z, item)) continue;
      const d = Math.hypot(item.x - p.kin.x, item.z - p.kin.z);
      if (d <= bestDist) {
        bestDist = d;
        best = item;
      }
    }
    if (best === null) return;
    best.taken = true;
    // Drop the current gun where the player stands.
    this.items.push({
      id: this.nextItemId++,
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
    this.broadcastRoom();
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
          if (inp.reload) this.tryReload(p, now);
          if (inp.fire) this.tryFire(p, now);
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
    this.broadcastSnap(now);
  }

  private tryReload(p: SPlayer, now: number): void {
    const spec = WEAPONS[p.weapon];
    if (p.reloadUntil !== 0 || p.mag >= spec.magSize) return;
    p.reloadUntil = now + spec.reloadTime * 1000;
    p.sprayIndex = 0;
  }

  private tryFire(p: SPlayer, now: number): void {
    const spec = WEAPONS[p.weapon];
    if (now - p.lastFireAt < spec.fireInterval * 1000) return;
    if (p.reloadUntil !== 0) return;
    if (p.mag <= 0) {
      this.tryReload(p, now);
      return;
    }
    // Deterministic spray pattern: reset after a pause, then advance.
    if (now - p.lastFireAt > spec.sprayResetTime * 1000) p.sprayIndex = 0;
    const [yawOff, pitchOff] = sprayOffset(spec, p.sprayIndex);
    p.sprayIndex++;
    p.lastFireAt = now;
    p.mag--;

    // Random inaccuracy (half-angle, radians).
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

    const targets = [...this.players.values()]
      .filter((o) => o !== p && o.alive && o.team !== null && o.team !== p.team)
      .map((o) => ({ id: o.id, x: o.kin.x, y: o.kin.y, z: o.kin.z }));

    const result = castShot(origin, dir, SOLIDS, targets, SHOT_RANGE);
    this.broadcast({ t: 'shot', shooterId: p.id, from: origin, to: result.point, weapon: p.weapon });

    if (result.playerId !== null) {
      const victim = this.players.get(result.playerId);
      if (!victim || !victim.alive) return;
      const dmg = result.headshot ? spec.dmgHead : spec.dmgBody;
      // Damage report bookkeeping (capped at the HP actually removed, CS-style)
      const dealt = Math.min(dmg, victim.hp);
      const entry = p.dmgGiven.get(victim.id) ?? { dmg: 0, hits: 0, killed: false };
      entry.dmg += dealt;
      entry.hits++;
      victim.hp = Math.max(0, victim.hp - dmg);
      if (victim.hp <= 0) entry.killed = true;
      p.dmgGiven.set(victim.id, entry);
      this.send(p.ws, { t: 'hitmark', headshot: result.headshot });
      this.send(victim.ws, {
        t: 'damage',
        fromX: p.kin.x,
        fromZ: p.kin.z,
        amount: dmg,
        hp: victim.hp,
      });
      if (victim.hp <= 0) {
        victim.alive = false;
        victim.deaths++;
        p.kills++;
        this.broadcast({ t: 'kill', killerId: p.id, victimId: victim.id, headshot: result.headshot });
        this.broadcastRoom();
        this.checkRoundOver();
      }
    }
  }

  // ---- state + messaging ----

  private teamPlayers(team: Team): SPlayer[] {
    return [...this.players.values()].filter((p) => p.team === team);
  }

  private roomState(): RoomState {
    return {
      phase: this.phase,
      scores: { ...this.scores },
      phaseEndsAt: this.phaseEndsAt,
      roundWinner: this.roundWinner,
      matchWinner: this.matchWinner,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        team: p.team,
        kills: p.kills,
        deaths: p.deaths,
        alive: p.alive,
        bot: p.ws === null,
      })),
      items: this.items.filter((i) => !i.taken),
    };
  }

  private broadcastRoom(): void {
    this.broadcast({ t: 'room', room: this.roomState() });
  }

  private broadcastSnap(now: number): void {
    const players: SnapPlayer[] = [...this.players.values()]
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
    for (const p of this.players.values()) {
      if (p.ws === null) continue; // bots don't receive snapshots
      const you =
        p.team !== null
          ? {
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
            }
          : null;
      this.send(p.ws, { t: 'snap', time: now, players, you });
    }
  }

  private send(ws: WebSocket | null, msg: ServerMsg): void {
    if (ws !== null && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMsg): void {
    const data = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.ws !== null && p.ws.readyState === p.ws.OPEN) p.ws.send(data);
    }
  }
}
