import type { InputFrame } from '@cs/shared';

const SENSITIVITY = 0.0023;
const PITCH_LIMIT = 1.55;

export class Input {
  yaw = 0;
  pitch = 0;
  /** Scope toggle latch (right click). Game logic decides whether it applies. */
  zoomLatch = false;
  /** Multiplier on mouse-look sensitivity (lowered while scoped). */
  sensitivityScale = 1;
  private keys = new Set<string>();
  private firing = false;
  private reloadQueued = false;
  private useQueued = false;
  private seq = 0;
  onTabChange: ((down: boolean) => void) | null = null;

  // ---- touch-mode state (fed by TouchControls) ----
  private touchMode = false;
  private touchMove = { x: 0, z: 0 };
  private touchJump = false;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.firing = true;
      if (e.button === 2) this.zoomLatch = !this.zoomLatch;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.firing = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const sens = SENSITIVITY * this.sensitivityScale;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this.onTabChange?.(true);
        return;
      }
      if (e.code === 'KeyR') this.reloadQueued = true;
      if (e.code === 'KeyE' && !e.repeat) this.useQueued = true;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this.onTabChange?.(false);
        return;
      }
      this.keys.delete(e.code);
    });
    document.addEventListener('pointerlockchange', () => {
      if (!this.locked) {
        this.keys.clear();
        this.firing = false;
        this.zoomLatch = false;
      }
    });
  }

  /** Touch devices have no pointer lock: input counts as always-captured. */
  get locked(): boolean {
    return this.touchMode || document.pointerLockElement === this.canvas;
  }

  requestLock(): void {
    if (this.touchMode) return;
    if (!this.locked) this.canvas.requestPointerLock();
  }

  // ---- touch-mode API ----

  enableTouch(): void {
    this.touchMode = true;
  }

  get isTouch(): boolean {
    return this.touchMode;
  }

  /** Analog movement vector from the virtual joystick (-1..1 each axis). */
  setTouchMove(x: number, z: number): void {
    this.touchMove.x = x;
    this.touchMove.z = z;
  }

  /** Drag-look from the touch look zone (deltas in pixels). */
  touchLook(dx: number, dy: number): void {
    const sens = SENSITIVITY * 2 * this.sensitivityScale;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
  }

  setFiring(firing: boolean): void {
    this.firing = firing;
  }

  setTouchJump(held: boolean): void {
    this.touchJump = held;
  }

  queueReload(): void {
    this.reloadQueued = true;
  }

  queueUse(): void {
    this.useQueued = true;
  }

  toggleZoom(): void {
    this.zoomLatch = !this.zoomLatch;
  }

  releaseLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  clearZoom(): void {
    this.zoomLatch = false;
  }

  sample(dt: number): InputFrame {
    const kx = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const kz = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const mx = Math.max(-1, Math.min(1, kx + this.touchMove.x));
    const mz = Math.max(-1, Math.min(1, kz + this.touchMove.z));
    const frame: InputFrame = {
      seq: ++this.seq,
      dt,
      mx,
      mz,
      jump: this.keys.has('Space') || this.touchJump,
      yaw: this.yaw,
      pitch: this.pitch,
      fire: this.firing && this.locked,
      reload: this.reloadQueued,
      use: this.useQueued,
      zoom: this.zoomLatch,
    };
    this.reloadQueued = false;
    this.useQueued = false;
    return frame;
  }

  setView(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = pitch;
  }
}
