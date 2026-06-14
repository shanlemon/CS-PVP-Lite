export type Ctx = CanvasRenderingContext2D;
export type RGB = [number, number, number];

export function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export function scaled(c: RGB, f: number): RGB {
  return [
    Math.min(255, Math.max(0, Math.round(c[0] * f))),
    Math.min(255, Math.max(0, Math.round(c[1] * f))),
    Math.min(255, Math.max(0, Math.round(c[2] * f))),
  ];
}

export function shade(c: RGB, f: number): string {
  const [r, gr, b] = scaled(c, f);
  return `rgb(${r},${gr},${b})`;
}

// Soft-edged radial blob, repeated across tile borders so edges wrap seamlessly.
export function wrappedBlob(
  g: Ctx,
  w: number,
  h: number,
  x: number,
  y: number,
  r: number,
  c: RGB,
  alpha: number,
): void {
  for (const ox of [-w, 0, w]) {
    for (const oy of [-h, 0, h]) {
      const cx = x + ox;
      const cy = y + oy;
      if (cx + r < 0 || cx - r > w || cy + r < 0 || cy - r > h) continue;
      const grad = g.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
      grad.addColorStop(0, rgba(c, alpha));
      grad.addColorStop(1, rgba(c, 0));
      g.fillStyle = grad;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }
}

// Small dot/ellipse, wrapped across borders.
export function wrappedDot(
  g: Ctx,
  w: number,
  h: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
): void {
  for (const ox of [-w, 0, w]) {
    for (const oy of [-h, 0, h]) {
      const cx = x + ox;
      const cy = y + oy;
      if (cx + rx < 0 || cx - rx > w || cy + ry < 0 || cy - ry > h) continue;
      g.fillStyle = fill;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

export function speckle(g: Ctx, w: number, h: number, count: number, colors: string[], rMin: number, rMax: number): void {
  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    wrappedDot(g, w, h, Math.random() * w, Math.random() * h, r, r, colors[Math.floor(Math.random() * colors.length)]);
  }
}

// Hairline crack: wandering polyline kept inside a margin so it never touches a border.
export function crack(g: Ctx, s: number, margin: number, color: string, width: number): void {
  let x = margin + Math.random() * (s - margin * 2);
  let y = margin + Math.random() * (s - margin * 2);
  let dir = Math.random() * Math.PI * 2;
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y);
  const segs = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < segs; i++) {
    dir += (Math.random() - 0.5) * 1.1;
    const len = 12 + Math.random() * 22;
    x = Math.min(s - margin * 0.5, Math.max(margin * 0.5, x + Math.cos(dir) * len));
    y = Math.min(s - margin * 0.5, Math.max(margin * 0.5, y + Math.sin(dir) * len));
    g.lineTo(x, y);
  }
  g.stroke();
}
