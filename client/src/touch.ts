import type { Input } from './input.js';

// On-screen controls for touch devices: a virtual joystick on the left,
// drag-to-look on the right, and action buttons. Everything feeds the same
// Input instance the keyboard/mouse path uses, so the server sees identical
// input frames. Pointer Events are used (not TouchEvents) so the controls are
// also testable with a mouse.

const JOY_RADIUS = 56; // px travel of the joystick knob
const DEADZONE = 0.18;

/** True when the page should boot with touch controls. */
export function isTouchDevice(): boolean {
  if (new URLSearchParams(location.search).has('touch')) return true;
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

function button(id: string, label: string, cls = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.id = id;
  b.className = `touch-btn ${cls}`;
  b.textContent = label;
  // Buttons must never steal focus or trigger double-tap zoom.
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return b;
}

export class TouchControls {
  private lastActive: boolean | null = null;
  private joyPointer: number | null = null;
  private lookPointer: number | null = null;
  private firePointer: number | null = null;
  private fireLast = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 };
  private joyCenter = { x: 0, y: 0 };
  private knob: HTMLDivElement;
  private base: HTMLDivElement;

  constructor(private input: Input) {
    input.enableTouch();
    document.body.classList.add('touch-mode');

    const ui = document.createElement('div');
    ui.id = 'touchUI';

    // ---- joystick (left zone) ----
    const joyZone = document.createElement('div');
    joyZone.id = 'joyZone';
    this.base = document.createElement('div');
    this.base.id = 'joyBase';
    this.knob = document.createElement('div');
    this.knob.id = 'joyKnob';
    this.base.appendChild(this.knob);
    this.base.style.display = 'none';
    joyZone.appendChild(this.base);

    joyZone.addEventListener('pointerdown', (e) => {
      if (this.joyPointer !== null) return;
      this.joyPointer = e.pointerId;
      try { joyZone.setPointerCapture(e.pointerId); } catch { /* synthetic events have no real pointer */ }
      this.joyCenter = { x: e.clientX, y: e.clientY };
      this.base.style.display = 'block';
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.moveKnob(0, 0);
    });
    joyZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointer) return;
      let dx = e.clientX - this.joyCenter.x;
      let dy = e.clientY - this.joyCenter.y;
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) {
        dx = (dx / len) * JOY_RADIUS;
        dy = (dy / len) * JOY_RADIUS;
      }
      this.moveKnob(dx, dy);
      let x = dx / JOY_RADIUS;
      let z = -dy / JOY_RADIUS; // up on screen = forward
      if (Math.hypot(x, z) < DEADZONE) {
        x = 0;
        z = 0;
      }
      this.input.setTouchMove(x, z);
    });
    const joyEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      this.base.style.display = 'none';
      this.input.setTouchMove(0, 0);
    };
    joyZone.addEventListener('pointerup', joyEnd);
    joyZone.addEventListener('pointercancel', joyEnd);

    // ---- look (right zone) ----
    const lookZone = document.createElement('div');
    lookZone.id = 'lookZone';
    lookZone.addEventListener('pointerdown', (e) => {
      if (this.lookPointer !== null) return;
      this.lookPointer = e.pointerId;
      try { lookZone.setPointerCapture(e.pointerId); } catch { /* synthetic events have no real pointer */ }
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointer) return;
      this.input.touchLook(e.clientX - this.lookLast.x, e.clientY - this.lookLast.y);
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    const lookEnd = (e: PointerEvent) => {
      if (e.pointerId === this.lookPointer) this.lookPointer = null;
    };
    lookZone.addEventListener('pointerup', lookEnd);
    lookZone.addEventListener('pointercancel', lookEnd);

    // ---- buttons ----
    // FIRE doubles as a look surface: while held, dragging the same finger
    // pans the aim, and firing continues until the finger actually lifts
    // (pointer capture keeps the stream even when it leaves the button).
    const fire = button('btnFire', 'FIRE', 'big');
    fire.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.firePointer = e.pointerId;
      try { fire.setPointerCapture(e.pointerId); } catch { /* synthetic events have no real pointer */ }
      this.fireLast = { x: e.clientX, y: e.clientY };
      this.input.setFiring(true);
    });
    fire.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.firePointer) return;
      this.input.touchLook(e.clientX - this.fireLast.x, e.clientY - this.fireLast.y);
      this.fireLast = { x: e.clientX, y: e.clientY };
    });
    const fireEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.firePointer) return;
      this.firePointer = null;
      this.input.setFiring(false);
    };
    fire.addEventListener('pointerup', fireEnd);
    fire.addEventListener('pointercancel', fireEnd);

    const jump = button('btnJump', 'JUMP');
    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { jump.setPointerCapture(e.pointerId); } catch { /* synthetic events have no real pointer */ }
      this.input.setTouchJump(true);
    });
    for (const ev of ['pointerup', 'pointercancel'] as const) {
      jump.addEventListener(ev, () => this.input.setTouchJump(false));
    }

    const reload = button('btnReload', 'R');
    reload.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.queueReload();
    });

    const use = button('btnUse', 'E');
    use.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.queueUse();
    });

    const scope = button('btnScope', '⌖'); // ⌖ position-indicator glyph
    scope.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.toggleZoom();
    });

    ui.append(joyZone, lookZone, fire, jump, reload, use, scope);
    document.body.appendChild(ui);

    // Show the controls only while actually playing (the game toggles this).
    this.setActive(false);
  }

  private moveKnob(dx: number, dy: number): void {
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  /** Show/hide the in-game controls (hidden in lobby / match end). */
  setActive(active: boolean): void {
    if (active === this.lastActive) return;
    this.lastActive = active;
    const ui = document.getElementById('touchUI');
    if (ui) ui.classList.toggle('hidden', !active);
    if (!active) {
      this.input.setTouchMove(0, 0);
      this.input.setFiring(false);
      this.input.setTouchJump(false);
      this.joyPointer = null;
      this.lookPointer = null;
      this.firePointer = null;
      this.base.style.display = 'none';
    }
  }
}
