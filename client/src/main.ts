import './style.css';
import type { Phase, RoomState, SelfSnap, Team } from '@cs/shared';
import { playDamage, playHit, unlockAudio } from './audio.js';
import { gameSocketUrl, resolveIdentity } from './discord.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Net } from './net.js';
import { TouchControls, isTouchDevice } from './touch.js';

const TEAM_BANNER: Record<Team, string> = {
  T: 'TERRORISTS WIN THE ROUND',
  CT: 'COUNTER-TERRORISTS WIN THE ROUND',
};

async function boot(): Promise<void> {
  const hud = new Hud();
  hud.setLoading('Connecting…');

  let identity;
  try {
    identity = await resolveIdentity();
  } catch (err) {
    console.error(err);
    hud.setLoading('Discord authorization failed. Reload the activity.');
    return;
  }

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const input = new Input(canvas);
  const net = new Net();
  const touch = isTouchDevice() ? new TouchControls(input) : null;
  if (touch) window.addEventListener('pointerdown', () => unlockAudio(), { once: true });

  let room: RoomState | null = null;
  let myId = '';
  let killedBy: string | null = null;
  let spectatingName: string | null = null;
  let scoreboardHeld = false;

  const game = new Game(canvas, input, net, {
    onVitals: (you: SelfSnap) => hud.setVitals(you),
    onZoom: (zoomed) => hud.setScope(zoomed),
    onPickupHint: (label) => hud.setPickupHint(label),
    onSpread: (gapPx) => hud.setCrosshairSpread(gapPx),
    onSpectate: (name) => {
      spectatingName = name;
    },
    onFrame: () => {
      if (!room) return;
      const me = room.players.find((p) => p.id === myId) ?? null;
      const playingPhase = room.phase === 'countdown' || room.phase === 'live' || room.phase === 'round_end';

      // Countdown number
      if (room.phase === 'countdown' && room.phaseEndsAt !== null) {
        const left = Math.max(0, Math.ceil((room.phaseEndsAt - Date.now()) / 1000));
        hud.setCountdown(left > 0 ? String(left) : 'GO');
      } else {
        hud.setCountdown(null);
      }

      // Click-to-play hint (pointer-lock devices only)
      hud.showClickToPlay(playingPhase && me?.team != null && me.alive && !input.locked && !input.isTouch);

      // Touch controls only while actually playing
      touch?.setActive(playingPhase && me?.team != null && me.alive);

      // Death overlay
      if (me?.team != null && !me.alive && (room.phase === 'live' || room.phase === 'round_end')) {
        hud.setDeath(killedBy ?? 'the enemy team', spectatingName);
      } else {
        hud.setDeath(null, null);
      }
    },
  });

  hud.onJoinTeam = (team) => {
    unlockAudio();
    net.send({ t: 'team', team });
  };
  hud.onStart = () => {
    unlockAudio();
    net.send({ t: 'start' });
  };
  hud.onAgain = () => net.send({ t: 'again' });
  hud.onAddBot = (team) => net.send({ t: 'addBot', team });
  hud.onRemoveBot = (id) => net.send({ t: 'removeBot', id });

  canvas.addEventListener('click', () => {
    unlockAudio();
    if (!room) return;
    const me = room.players.find((p) => p.id === myId);
    const playingPhase = room.phase === 'countdown' || room.phase === 'live' || room.phase === 'round_end';
    if (playingPhase && me?.team != null) input.requestLock();
  });

  input.onTabChange = (down) => {
    scoreboardHeld = down;
    hud.showScoreboard(room, myId, down);
  };

  net.onMessage((msg) => {
    switch (msg.t) {
      case 'welcome': {
        // Clear the overlay FIRST — if applying the room state ever throws,
        // the game must not stay wedged behind a "Connecting…" veil.
        hud.setLoading(null);
        myId = msg.id;
        game.myId = msg.id;
        applyRoom(msg.room);
        break;
      }
      case 'room':
        applyRoom(msg.room);
        break;
      case 'snap':
      case 'shot':
        game.handleMessage(msg);
        break;
      case 'hitmark':
        hud.flashHitmarker(msg.headshot);
        playHit(msg.headshot);
        break;
      case 'damage': {
        const me = room?.players.find((p) => p.id === myId);
        if (me) {
          // offset from me to attacker, using my predicted view yaw
          hud.showDamage(msg.fromX - cameraX(), msg.fromZ - cameraZ(), input.yaw);
        }
        playDamage();
        break;
      }
      case 'kill': {
        const killer = room?.players.find((p) => p.id === msg.killerId);
        const victim = room?.players.find((p) => p.id === msg.victimId);
        hud.addKillFeed(killer, victim, msg.headshot);
        if (msg.victimId === myId) killedBy = killer?.name ?? null;
        break;
      }
      case 'damageReport':
        hud.showDamageReport(msg.rows);
        break;
      case 'error':
        console.warn('server error:', msg.message);
        break;
    }
  });

  // Camera position helpers for the damage indicator (predicted self position).
  function cameraX(): number {
    return gameCameraPos().x;
  }
  function cameraZ(): number {
    return gameCameraPos().z;
  }
  function gameCameraPos(): { x: number; z: number } {
    // The predicted state lives in Game; approximate with the last snap-driven
    // HUD state is unnecessary — Game exposes its camera via the scene.
    return game.cameraPosition();
  }

  function applyRoom(next: RoomState): void {
    const prevPhase: Phase | null = room?.phase ?? null;
    room = next;
    game.room = next;

    if (next.phase !== prevPhase) {
      if (next.phase === 'countdown') {
        killedBy = null;
        hud.setBanner(null);
        hud.hideDamageReport();
        const me = next.players.find((p) => p.id === myId);
        if (me?.team) input.setView(me.team === 'T' ? 0 : Math.PI, 0);
      } else if (next.phase === 'round_end' && next.roundWinner) {
        hud.setBanner(TEAM_BANNER[next.roundWinner], next.roundWinner.toLowerCase());
      } else if (next.phase === 'live') {
        hud.setBanner(null);
      } else if (next.phase === 'lobby' || next.phase === 'match_end') {
        hud.setBanner(null);
        if (next.phase === 'lobby') hud.hideDamageReport();
        input.releaseLock();
      }
    }

    hud.update(next, myId);
    if (scoreboardHeld) hud.showScoreboard(next, myId, true);
  }

  try {
    await net.connect(gameSocketUrl(identity.embedded), {
      t: 'hello',
      name: identity.name,
      avatarUrl: identity.avatarUrl,
      instanceId: identity.instanceId,
    });
  } catch {
    hud.setLoading('Could not reach the game server. Is it running?');
    return;
  }

  // Connection drops auto-retry; the next 'welcome' clears the overlay.
  net.onDisconnect = () => hud.setLoading('Reconnecting…');

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__cs = { game, input, net };
  }
}

void boot();
