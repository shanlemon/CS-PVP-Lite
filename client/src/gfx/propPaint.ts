/** Soft radial blob that fades to transparent without dark halos. */
export function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  a: number,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Fine grain noise pass. */
export function speckle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  count: number,
  rgbs: string[],
  sizeMin: number,
  sizeMax: number,
  alpha: number,
): void {
  for (let i = 0; i < count; i++) {
    const rgb = rgbs[Math.floor(rand() * rgbs.length)];
    ctx.fillStyle = `rgba(${rgb},${alpha * (0.35 + rand() * 0.65)})`;
    const s = sizeMin + rand() * (sizeMax - sizeMin);
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
}

/** Faint vertical weathering streaks. */
export function streaks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  count: number,
  rgb: string,
  alpha: number,
): void {
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y0 = rand() * h * 0.6;
    const len = h * (0.2 + rand() * 0.5);
    const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y0, 1 + rand() * 2.5, len);
  }
}

/** Thin meandering hairline cracks. */
export function cracks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  count: number,
  rgb: string,
  alpha: number,
): void {
  ctx.strokeStyle = `rgba(${rgb},${alpha})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    let x = rand() * w;
    let y = rand() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 3 + Math.floor(rand() * 4);
    for (let s = 0; s < steps; s++) {
      x += (rand() - 0.5) * 28;
      y += rand() * 16;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** Layered stucco base: flat tan + large mottling + fine speckle + streaks. */
export function paintStucco(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  base: string,
  lightRgb: string,
  darkRgb: string,
): void {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    blob(
      ctx,
      rand() * w,
      rand() * h,
      w * (0.1 + rand() * 0.22),
      rand() < 0.5 ? lightRgb : darkRgb,
      0.05 + rand() * 0.08,
    );
  }
  speckle(ctx, w, h, rand, Math.round((w * h) / 90), [lightRgb, darkRgb], 1, 2.2, 0.16);
  streaks(ctx, w, h, rand, 12, darkRgb, 0.07);
}

/** Round-topped (arched) window/door path. */
export function archPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  w: number,
  h: number,
): void {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx - r, top + h);
  ctx.lineTo(cx - r, top + r);
  ctx.arc(cx, top + r, r, Math.PI, 0);
  ctx.lineTo(cx + r, top + h);
  ctx.closePath();
}
