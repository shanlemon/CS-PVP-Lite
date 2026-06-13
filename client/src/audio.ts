// Tiny procedural sound effects (no asset files — keeps the activity CSP-clean).

import type { WeaponType } from '@cs/shared';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (ctx === null) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call once from a user gesture to unlock audio. */
export function unlockAudio(): void {
  ac();
}

export function playShot(volume: number, weapon: WeaponType): void {
  const a = ac();
  if (!a || volume <= 0.01) return;
  const t = a.currentTime;

  // Per-weapon report: AK = the original crack, M4 = tighter/higher,
  // AWP = a long heavy boom with a deep filter sweep.
  const awp = weapon === 'awp';
  const len = awp ? 0.3 : weapon === 'm4a4' ? 0.09 : 0.12;
  const buf = a.createBuffer(1, Math.round(a.sampleRate * len), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const decay = 1 - i / data.length;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(awp ? 2000 : weapon === 'm4a4' ? 4200 : 3500, t);
  filter.frequency.exponentialRampToValueAtTime(awp ? 150 : weapon === 'm4a4' ? 500 : 400, t + len);
  const gain = a.createGain();
  gain.gain.value = 0.35 * volume * (awp ? 1.5 : 1);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t);

  if (awp) {
    // Low sine thump underneath the boom.
    const osc = a.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, t);
    const og = a.createGain();
    og.gain.setValueAtTime(0.4 * volume, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(og).connect(a.destination);
    osc.start(t);
    osc.stop(t + 0.21);
  }
}

export function playHit(headshot: boolean): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(headshot ? 1400 : 900, t);
  osc.frequency.exponentialRampToValueAtTime(headshot ? 700 : 500, t + 0.07);
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.09);
}

export function playDamage(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.15);
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.17);
}
