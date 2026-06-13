import { ROUNDS_TO_WIN, TEAM_SIZE, WEAPONS } from '@cs/shared';
import type { DamageReportRow, RoomState, RosterEntry, SelfSnap, Team } from '@cs/shared';

const TEAM_LABEL: Record<Team, string> = { T: 'TERRORISTS', CT: 'COUNTER-TERRORISTS' };

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function avatarHtml(p: RosterEntry): string {
  if (p.avatarUrl) return `<img src="${p.avatarUrl}" alt="">`;
  const initial = p.name.charAt(0).toUpperCase();
  return `<span class="avatar-fallback">${initial}</span>`;
}

export class Hud {
  onJoinTeam: ((team: Team) => void) | null = null;
  onStart: (() => void) | null = null;
  onAgain: (() => void) | null = null;
  onAddBot: ((team: Team) => void) | null = null;
  onRemoveBot: ((id: string) => void) | null = null;

  private hitmarkTimer: ReturnType<typeof setTimeout> | null = null;
  private feedCount = 0;
  private pickupLabel: string | null = null;
  private scoreboardShown = false;

  constructor() {
    for (const btn of document.querySelectorAll<HTMLButtonElement>('.join-btn')) {
      btn.addEventListener('click', () => this.onJoinTeam?.(btn.dataset.team as Team));
      // Wrap the join button in an action row and add the '+ Add Bot' button next to it.
      const row = document.createElement('div');
      row.className = 'team-actions';
      btn.parentElement!.appendChild(row);
      row.appendChild(btn);
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'add-bot hidden';
      add.dataset.team = btn.dataset.team;
      add.textContent = '+ Add Bot';
      row.appendChild(add);
    }
    // Bot controls are wired once via delegation: the lobby re-renders often,
    // so clicks bubble up to this stable container instead of per-render handlers.
    document.querySelector<HTMLElement>('.teams')!.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const remove = target.closest<HTMLButtonElement>('.bot-remove');
      if (remove?.dataset.id) {
        this.onRemoveBot?.(remove.dataset.id);
        return;
      }
      const add = target.closest<HTMLButtonElement>('.add-bot');
      if (add?.dataset.team) this.onAddBot?.(add.dataset.team as Team);
    });
    el('startBtn').addEventListener('click', () => this.onStart?.());
    el('againBtn').addEventListener('click', () => this.onAgain?.());
  }

  setLoading(text: string | null): void {
    el('loading').classList.toggle('hidden', text === null);
    if (text !== null) el('loadingText').textContent = text;
  }

  /** Master visibility + content refresh, driven by room state changes. */
  update(room: RoomState, myId: string): void {
    const me = room.players.find((p) => p.id === myId) ?? null;
    const inLobby = room.phase === 'lobby';
    const inMatchEnd = room.phase === 'match_end';
    const showLobby = inLobby || (!inMatchEnd && me?.team == null);

    el('lobby').classList.toggle('hidden', !showLobby);
    el('matchEnd').classList.toggle('hidden', !inMatchEnd);
    el('hud').classList.toggle('hidden', showLobby || inMatchEnd);

    if (showLobby) this.renderLobby(room, myId);
    if (inMatchEnd) this.renderMatchEnd(room);

    el('scoreT').textContent = String(room.scores.T);
    el('scoreCT').textContent = String(room.scores.CT);
  }

  private renderLobby(room: RoomState, myId: string): void {
    const me = room.players.find((p) => p.id === myId) ?? null;
    const inLobby = room.phase === 'lobby';
    for (const team of ['T', 'CT'] as const) {
      const members = room.players.filter((p) => p.team === team);
      const slots = el(`slots-${team}`);
      slots.innerHTML = '';
      for (let i = 0; i < TEAM_SIZE; i++) {
        const p = members[i];
        const div = document.createElement('div');
        if (p?.bot) {
          div.className = 'slot bot';
          div.innerHTML =
            `<span class="avatar-fallback bot-glyph">🤖</span>` +
            `<span class="bot-name">${escapeHtml(p.name)}</span>` +
            `<button type="button" class="bot-remove" data-id="${escapeHtml(p.id)}" title="Remove bot"${inLobby ? '' : ' disabled'}>✕</button>`;
        } else if (p) {
          div.className = 'slot';
          div.innerHTML = `${avatarHtml(p)}<span>${escapeHtml(p.name)}</span>${p.id === myId ? '<span class="you">YOU</span>' : ''}`;
        } else {
          div.className = 'slot empty';
          div.textContent = 'Open slot';
        }
        slots.appendChild(div);
      }
      const btn = document.querySelector<HTMLButtonElement>(`.join-btn[data-team="${team}"]`)!;
      btn.disabled = members.length >= TEAM_SIZE || me?.team === team;
      btn.textContent = me?.team === team ? `On ${team}` : `Join ${team}`;
      const addBtn = document.querySelector<HTMLButtonElement>(`.add-bot[data-team="${team}"]`)!;
      addBtn.classList.toggle('hidden', !inLobby);
      addBtn.disabled = members.length >= TEAM_SIZE;
    }

    const spectators = room.players.filter((p) => p.team === null);
    el('spectatorRow').textContent =
      spectators.length > 0 ? `Spectating: ${spectators.map((p) => p.name).join(', ')}` : '';

    const canStart =
      room.phase === 'lobby' &&
      room.players.some((p) => p.team === 'T') &&
      room.players.some((p) => p.team === 'CT');
    const startBtn = el<HTMLButtonElement>('startBtn');
    startBtn.disabled = !canStart;
    startBtn.classList.toggle('hidden', room.phase !== 'lobby');
    el('lobbyHint').textContent =
      room.phase !== 'lobby'
        ? 'Match in progress — join an open slot to play from the next round.'
        : canStart
          ? `First to ${ROUNDS_TO_WIN} rounds wins. Anyone can start.`
          : 'Both teams need at least one player — add a bot if you\'re short.';
  }

  private renderMatchEnd(room: RoomState): void {
    const winner = room.matchWinner;
    const h1 = el('matchWinnerText');
    h1.textContent = winner ? `${TEAM_LABEL[winner]} WIN ${room.scores[winner]}–${room.scores[winner === 'T' ? 'CT' : 'T']}` : 'MATCH OVER';
    h1.className = winner ? winner.toLowerCase() : '';
    el('finalBoard').innerHTML = this.scoreboardHtml(room, '');
  }

  setVitals(you: SelfSnap): void {
    el('hpVal').textContent = String(you.hp);
    el('magVal').textContent = String(you.mag);
    el('weaponName').textContent = WEAPONS[you.weapon].name;
    el('reloadNote').classList.toggle('hidden', !you.reloading);
  }

  private crosshairArms: HTMLElement[] | null = null;
  private lastGap = -1;

  /** Spread the 4 crosshair arms apart by gapPx (CS-style dynamic crosshair). */
  setCrosshairSpread(gapPx: number): void {
    const gap = Math.min(70, Math.round(gapPx * 2) / 2); // clamp + quantize
    if (gap === this.lastGap) return;
    this.lastGap = gap;
    if (!this.crosshairArms) {
      this.crosshairArms = Array.from(document.querySelectorAll<HTMLElement>('#crosshair i'));
    }
    const [top, bottom, left, right] = this.crosshairArms;
    if (!right) return;
    top.style.top = `${-11 - gap}px`;
    bottom.style.top = `${4 + gap}px`;
    left.style.left = `${-11 - gap}px`;
    right.style.left = `${4 + gap}px`;
  }

  /** End-of-round damage breakdown (shown through round_end / match_end). */
  showDamageReport(rows: DamageReportRow[]): void {
    const panel = el('dmgReport');
    let html = '<h4>ROUND DAMAGE</h4>';
    if (rows.length === 0) {
      html += '<p class="dmg-none">No damage dealt this round.</p>';
    } else {
      for (const r of rows) {
        const cls = r.team ? r.team.toLowerCase() : '';
        html += `<div class="dmg-row"><span class="dmg-name ${cls}">${escapeHtml(r.name)}</span><span class="dmg-val">${r.dmg} dmg</span><span class="dmg-hits">${r.hits} hit${r.hits === 1 ? '' : 's'}</span><span class="dmg-skull">${r.killed ? '☠' : ''}</span></div>`;
      }
    }
    panel.innerHTML = html;
    panel.classList.remove('hidden');
  }

  hideDamageReport(): void {
    el('dmgReport').classList.add('hidden');
  }

  /** AWP scope overlay; the normal crosshair hides while scoped. */
  setScope(show: boolean): void {
    el('scope').classList.toggle('hidden', !show);
    el('crosshair').classList.toggle('hidden', show);
  }

  setPickupHint(label: string | null): void {
    this.pickupLabel = label;
    this.refreshPickupHint();
  }

  private refreshPickupHint(): void {
    const hint = el('pickupHint');
    const show = this.pickupLabel !== null && !this.scoreboardShown;
    hint.classList.toggle('hidden', !show);
    if (this.pickupLabel !== null) hint.textContent = `[E] Pick up ${this.pickupLabel}`;
  }

  flashHitmarker(headshot: boolean): void {
    const hm = el('hitmarker');
    hm.classList.toggle('head', headshot);
    hm.style.opacity = '1';
    if (this.hitmarkTimer) clearTimeout(this.hitmarkTimer);
    this.hitmarkTimer = setTimeout(() => (hm.style.opacity = '0'), 90);
  }

  /** Directional damage indicator. Inputs: attacker offset + own view yaw. */
  showDamage(ox: number, oz: number, myYaw: number): void {
    const needYaw = Math.atan2(-ox, -oz);
    let delta = needYaw - myYaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const deg = (-delta * 180) / Math.PI;
    const dir = el('damageDir');
    dir.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
    dir.style.opacity = '1';
    setTimeout(() => (dir.style.opacity = '0'), 450);

    const vin = el('vignette');
    vin.style.opacity = '1';
    setTimeout(() => (vin.style.opacity = '0'), 300);
  }

  addKillFeed(killer: RosterEntry | undefined, victim: RosterEntry | undefined, headshot: boolean): void {
    const feed = el('killfeed');
    const row = document.createElement('div');
    row.className = 'feed-row';
    const kName = killer ? `<span class="${killer.team?.toLowerCase() ?? ''}">${escapeHtml(killer.name)}</span>` : '?';
    const vName = victim ? `<span class="${victim.team?.toLowerCase() ?? ''}">${escapeHtml(victim.name)}</span>` : '?';
    row.innerHTML = `${kName} ${headshot ? '<span class="hs">☠⌖</span>' : '🗡'} ${vName}`;
    feed.appendChild(row);
    this.feedCount++;
    setTimeout(() => {
      row.remove();
    }, 5000);
    while (feed.children.length > 5) feed.firstChild?.remove();
  }

  setCountdown(text: string | null): void {
    const cd = el('countdown');
    cd.classList.toggle('hidden', text === null);
    if (text !== null) cd.textContent = text;
  }

  setBanner(text: string | null, cls = ''): void {
    const b = el('banner');
    b.classList.toggle('hidden', text === null);
    if (text !== null) {
      b.textContent = text;
      b.className = cls; // resets, keeps id styling
    }
  }

  setDeath(killerName: string | null, spectating: string | null): void {
    const overlay = el('deathOverlay');
    overlay.classList.toggle('hidden', killerName === null);
    if (killerName !== null) {
      el('deathBy').textContent = `You were killed by ${killerName}`;
      el('spectatingNote').textContent = spectating ? `Spectating ${spectating}` : '';
    }
  }

  showClickToPlay(show: boolean): void {
    el('clickToPlay').classList.toggle('hidden', !show);
  }

  showScoreboard(room: RoomState | null, myId: string, show: boolean): void {
    const visible = show && room !== null;
    const sb = el('scoreboard');
    sb.classList.toggle('hidden', !visible);
    if (visible && room) sb.innerHTML = this.scoreboardHtml(room, myId);
    this.scoreboardShown = visible;
    this.refreshPickupHint();
  }

  private scoreboardHtml(room: RoomState, myId: string): string {
    let html = `<table><tr><th>Player</th><th>K</th><th>D</th></tr>`;
    for (const team of ['T', 'CT'] as const) {
      html += `<tr><td class="team-head ${team.toLowerCase()}" colspan="3">${TEAM_LABEL[team]} — ${room.scores[team]}</td></tr>`;
      const members = room.players
        .filter((p) => p.team === team)
        .sort((a, b) => b.kills - a.kills);
      for (const p of members) {
        html += `<tr class="${p.alive ? '' : 'dead'}"><td>${escapeHtml(p.name)}${p.id === myId ? ' (you)' : ''}</td><td>${p.kills}</td><td>${p.deaths}</td></tr>`;
      }
    }
    html += '</table>';
    return html;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
