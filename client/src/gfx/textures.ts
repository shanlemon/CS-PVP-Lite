import * as THREE from 'three';

// Procedural Dust2-style textures, drawn entirely on HTML canvases.
// No external image files — Discord activity CSP requires self-contained assets.
// Every tileable texture wraps its features across the canvas borders manually.

type Ctx = CanvasRenderingContext2D;
type RGB = [number, number, number];

function createCanvas(w: number, h: number): { canvas: HTMLCanvasElement; g: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  return { canvas, g };
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function scaled(c: RGB, f: number): RGB {
  return [
    Math.min(255, Math.max(0, Math.round(c[0] * f))),
    Math.min(255, Math.max(0, Math.round(c[1] * f))),
    Math.min(255, Math.max(0, Math.round(c[2] * f))),
  ];
}

function shade(c: RGB, f: number): string {
  const [r, gr, b] = scaled(c, f);
  return `rgb(${r},${gr},${b})`;
}

// Soft-edged radial blob, repeated across tile borders so edges wrap seamlessly.
function wrappedBlob(g: Ctx, w: number, h: number, x: number, y: number, r: number, c: RGB, alpha: number): void {
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
function wrappedDot(g: Ctx, w: number, h: number, x: number, y: number, rx: number, ry: number, fill: string): void {
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

function speckle(g: Ctx, w: number, h: number, count: number, colors: string[], rMin: number, rMax: number): void {
  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    wrappedDot(g, w, h, Math.random() * w, Math.random() * h, r, r, colors[Math.floor(Math.random() * colors.length)]);
  }
}

// Hairline crack: wandering polyline kept inside a margin so it never touches a border.
function crack(g: Ctx, s: number, margin: number, color: string, width: number): void {
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

// ---------------------------------------------------------------------------
// Stucco — sandy tan plaster like the reference walls.
// ---------------------------------------------------------------------------

export function stuccoTexture(): THREE.CanvasTexture {
  const s = 512;
  const { canvas, g } = createCanvas(s, s);

  // Base fill.
  g.fillStyle = '#c8ae7d';
  g.fillRect(0, 0, s, s);

  // Large soft mottled patches — lighter and darker, lots of overlap.
  for (let i = 0; i < 34; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 40 + Math.random() * 80, [226, 206, 162], 0.05 + Math.random() * 0.06);
  }
  for (let i = 0; i < 34; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 36 + Math.random() * 90, [150, 124, 84], 0.04 + Math.random() * 0.06);
  }

  // Fine grain speckle.
  speckle(g, s, s, 1500, ['#bfa471', '#d2b888', '#b09766', '#d8c193', '#a98f5e'], 0.4, 1.7);

  // Subtle vertical weathering streaks (full height so they tile vertically).
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * s;
    const w = 2 + Math.random() * 11;
    g.fillStyle = rgba([110, 92, 58], 0.025 + Math.random() * 0.035);
    g.fillRect(x, 0, w, s);
    if (x + w > s) g.fillRect(x - s, 0, w, s);
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * s;
    const w = 3 + Math.random() * 6;
    g.fillStyle = rgba([232, 216, 178], 0.03);
    g.fillRect(x, 0, w, s);
    if (x + w > s) g.fillRect(x - s, 0, w, s);
  }

  // A few faint hairline cracks.
  for (let i = 0; i < 4; i++) {
    crack(g, s, 70, 'rgba(74,58,32,0.32)', 0.9);
  }

  // Dust accumulation: darker lower third. The band is centered on the wrap
  // line (bottom edge alpha matches top edge alpha) so vertical tiling stays
  // seamless while each repeat reads as dust at its base.
  let grad = g.createLinearGradient(0, s * 0.62, 0, s);
  grad.addColorStop(0, rgba([95, 78, 48], 0));
  grad.addColorStop(1, rgba([95, 78, 48], 0.1));
  g.fillStyle = grad;
  g.fillRect(0, s * 0.62, s, s * 0.38);
  grad = g.createLinearGradient(0, 0, 0, s * 0.08);
  grad.addColorStop(0, rgba([95, 78, 48], 0.1));
  grad.addColorStop(1, rgba([95, 78, 48], 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s * 0.08);

  return toTexture(canvas);
}

// ---------------------------------------------------------------------------
// Trim band — dark decorative border with tan diamond pattern (Dust2 style).
// ---------------------------------------------------------------------------

export function trimBandTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const { canvas, g } = createCanvas(w, h);
  const tan = '#c8ae7d';

  // Deep brown-to-navy base.
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#3a3026');
  base.addColorStop(1, '#2c2a38');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

  // Base grain noise.
  speckle(g, w, h, 260, ['rgba(20,18,14,0.30)', 'rgba(82,74,62,0.22)', 'rgba(58,52,64,0.25)'], 0.4, 1.2);

  // Two horizontal pinstripes.
  g.fillStyle = tan;
  g.fillRect(0, 14, w, 3);
  g.fillRect(0, 111, w, 3);

  // Repeating diamond/lozenge row (period 64 divides 512 → tiles horizontally).
  const period = 64;
  for (let k = 0; k < w / period; k++) {
    const cx = period / 2 + k * period;
    const cy = h / 2;
    // Outer tan lozenge.
    g.fillStyle = tan;
    g.beginPath();
    g.moveTo(cx, cy - 32);
    g.lineTo(cx + 19, cy);
    g.lineTo(cx, cy + 32);
    g.lineTo(cx - 19, cy);
    g.closePath();
    g.fill();
    // Inner dark diamond, leaving a crisp tan border.
    g.fillStyle = '#332e30';
    g.beginPath();
    g.moveTo(cx, cy - 20);
    g.lineTo(cx + 11, cy);
    g.lineTo(cx, cy + 20);
    g.lineTo(cx - 11, cy);
    g.closePath();
    g.fill();
    // Tan center dot.
    g.fillStyle = tan;
    g.beginPath();
    g.arc(cx, cy, 4, 0, Math.PI * 2);
    g.fill();
    // Small accent dot midway between diamonds (on the period boundary).
    g.beginPath();
    g.arc(k * period, cy, 3, 0, Math.PI * 2);
    g.fill();
  }
  // Wrap the x=0 accent dot across the right border so the tile is seamless.
  g.fillStyle = tan;
  g.beginPath();
  g.arc(w, h / 2, 3, 0, Math.PI * 2);
  g.fill();

  // Wear: erode a few pattern pixels back to the dark base.
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * w;
    const y = 10 + Math.random() * (h - 20);
    g.fillStyle = `rgba(${44 + Math.floor(Math.random() * 12)},${40 + Math.floor(Math.random() * 8)},${42 + Math.floor(Math.random() * 12)},${0.5 + Math.random() * 0.4})`;
    g.fillRect(x, y, 1 + Math.random() * 2.5, 1 + Math.random() * 2);
  }

  return toTexture(canvas);
}

// ---------------------------------------------------------------------------
// Coping — light stone for wall tops.
// ---------------------------------------------------------------------------

export function copingTexture(): THREE.CanvasTexture {
  const s = 256;
  const { canvas, g } = createCanvas(s, s);

  g.fillStyle = '#d8d1bf';
  g.fillRect(0, 0, s, s);

  // Gentle tonal blotches.
  for (let i = 0; i < 14; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 26 + Math.random() * 50, [232, 226, 212], 0.06);
  }
  for (let i = 0; i < 12; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 24 + Math.random() * 46, [168, 158, 134], 0.05);
  }

  // Light speckle.
  speckle(g, s, s, 600, ['#cfc7b2', '#e2dccb', '#c8bfa8', '#bdb49c'], 0.3, 1.2);

  // Stone joint lines every ~128px (at 64/192 so they avoid the tile border),
  // each with a thin bevel highlight.
  for (const x of [64, 192]) {
    g.fillStyle = 'rgba(110,102,84,0.55)';
    g.fillRect(x, 0, 2, s);
    g.fillStyle = 'rgba(255,255,248,0.35)';
    g.fillRect(x + 2, 0, 1, s);
  }
  for (const y of [64, 192]) {
    g.fillStyle = 'rgba(110,102,84,0.5)';
    g.fillRect(0, y, s, 2);
    g.fillStyle = 'rgba(255,255,248,0.3)';
    g.fillRect(0, y + 2, s, 1);
  }

  return toTexture(canvas);
}

// ---------------------------------------------------------------------------
// Dirt — packed desert ground for the arena floor.
// ---------------------------------------------------------------------------

export function dirtTexture(): THREE.CanvasTexture {
  const s = 512;
  const { canvas, g } = createCanvas(s, s);

  g.fillStyle = '#ad8d5c';
  g.fillRect(0, 0, s, s);

  // Very large, soft macro patches first — these carry the read at distance.
  for (let i = 0; i < 10; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 110 + Math.random() * 130, [126, 100, 62], 0.07 + Math.random() * 0.06);
  }
  for (let i = 0; i < 7; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 100 + Math.random() * 120, [205, 180, 130], 0.06 + Math.random() * 0.05);
  }

  // Large irregular tonal patches.
  for (let i = 0; i < 28; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 46 + Math.random() * 90, [206, 182, 132], 0.08 + Math.random() * 0.08);
  }
  for (let i = 0; i < 28; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 40 + Math.random() * 95, [128, 102, 64], 0.08 + Math.random() * 0.08);
  }

  // Faint broad track streaks, all running one diagonal direction. Each streak
  // is stroked at 3x3 tile offsets so it wraps on both axes.
  const ang = -28 * (Math.PI / 180);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const px = Math.random() * s;
    const py = Math.random() * s;
    const wWidth = 14 + Math.random() * 18;
    const dark = Math.random() < 0.65;
    g.strokeStyle = dark ? rgba([118, 96, 60], 0.05) : rgba([212, 192, 142], 0.045);
    g.lineWidth = wWidth;
    for (const ox of [-s, 0, s]) {
      for (const oy of [-s, 0, s]) {
        g.beginPath();
        g.moveTo(px + ox - dx * 700, py + oy - dy * 700);
        g.lineTo(px + ox + dx * 700, py + oy + dy * 700);
        g.stroke();
      }
    }
  }

  // Scattered pebbles: 1px darker shadow under each small ellipse.
  const pebbleColors = ['#c7b285', '#a78f60', '#9d9281', '#bfa97a', '#8f7a52', '#b3a489'];
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const rx = 1 + Math.random() * 1.2;
    const ry = rx * (0.7 + Math.random() * 0.5);
    wrappedDot(g, s, s, x + 1, y + 1.2, rx, ry, 'rgba(80,62,38,0.5)');
    wrappedDot(g, s, s, x, y, rx, ry, pebbleColors[Math.floor(Math.random() * pebbleColors.length)]);
  }

  // Fine noise.
  speckle(g, s, s, 1300, ['#ae8f5e', '#c2a472', '#a08453', '#cbb07c'], 0.4, 1.3);

  return toTexture(canvas);
}

// ---------------------------------------------------------------------------
// Concrete — light warm grey for platforms, steps and edge strips.
// ---------------------------------------------------------------------------

export function concreteTexture(): THREE.CanvasTexture {
  const s = 256;
  const { canvas, g } = createCanvas(s, s);

  g.fillStyle = '#b3a78f';
  g.fillRect(0, 0, s, s);

  // Tonal variation.
  for (let i = 0; i < 12; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 28 + Math.random() * 50, [200, 192, 168], 0.06);
  }
  for (let i = 0; i < 10; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 26 + Math.random() * 44, [140, 130, 106], 0.05);
  }

  // Aggregate speckle.
  speckle(g, s, s, 850, ['#a39880', '#c1b69e', '#998d74', '#cabfa7', '#8d8268'], 0.3, 1.3);

  // Faint stains.
  for (let i = 0; i < 3; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 30 + Math.random() * 40, [92, 82, 58], 0.06);
  }

  // One or two hairline cracks, kept off the borders.
  for (let i = 0; i < 2; i++) {
    crack(g, s, 44, 'rgba(70,62,44,0.35)', 0.8);
  }

  // Subtle edge darkening — symmetric on all four edges, so the repeat reads
  // as faint panel joints rather than a seam.
  const edge = 12;
  const vc: RGB = [62, 56, 42];
  let grad = g.createLinearGradient(0, 0, 0, edge);
  grad.addColorStop(0, rgba(vc, 0.07));
  grad.addColorStop(1, rgba(vc, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, s, edge);
  grad = g.createLinearGradient(0, s, 0, s - edge);
  grad.addColorStop(0, rgba(vc, 0.07));
  grad.addColorStop(1, rgba(vc, 0));
  g.fillStyle = grad;
  g.fillRect(0, s - edge, s, edge);
  grad = g.createLinearGradient(0, 0, edge, 0);
  grad.addColorStop(0, rgba(vc, 0.07));
  grad.addColorStop(1, rgba(vc, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, edge, s);
  grad = g.createLinearGradient(s, 0, s - edge, 0);
  grad.addColorStop(0, rgba(vc, 0.07));
  grad.addColorStop(1, rgba(vc, 0));
  g.fillStyle = grad;
  g.fillRect(s - edge, 0, edge, s);

  return toTexture(canvas);
}

// ---------------------------------------------------------------------------
// Crates — pine wood with frames, X-braces, brackets and stencils.
// ---------------------------------------------------------------------------

const CRATE_BASES: RGB[] = [
  [185, 142, 78], // honey pine
  [201, 168, 104], // pale pine
  [151, 116, 63], // weathered brown
];

const FRAME_MARGIN = 28;

function crateBase(variant: number): RGB {
  return CRATE_BASES[((variant % 3) + 3) % 3];
}

// Long wavy low-alpha grain strokes inside a clipped region.
function woodGrain(g: Ctx, x: number, y: number, w: number, h: number, vertical: boolean, base: RGB, count: number): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  for (let i = 0; i < count; i++) {
    const dark = Math.random() < 0.6;
    g.strokeStyle = dark
      ? rgba(scaled(base, 0.58), 0.10 + Math.random() * 0.14)
      : rgba(scaled(base, 1.2), 0.08 + Math.random() * 0.1);
    g.lineWidth = 0.6 + Math.random() * 1.1;
    g.beginPath();
    if (vertical) {
      let gx = x + Math.random() * w;
      g.moveTo(gx, y - 4);
      for (let yy = y; yy <= y + h + 8; yy += 14) {
        gx += (Math.random() - 0.5) * 3.2;
        g.lineTo(gx, yy);
      }
    } else {
      let gy = y + Math.random() * h;
      g.moveTo(x - 4, gy);
      for (let xx = x; xx <= x + w + 8; xx += 14) {
        gy += (Math.random() - 0.5) * 3.2;
        g.lineTo(xx, gy);
      }
    }
    g.stroke();
  }
  // A few small knots.
  for (let i = 0; i < Math.max(1, Math.floor(count / 14)); i++) {
    const kx = x + 8 + Math.random() * (w - 16);
    const ky = y + 8 + Math.random() * (h - 16);
    g.strokeStyle = rgba(scaled(base, 0.46), 0.35);
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(kx, ky, 2.5 + Math.random() * 2, 1.6 + Math.random() * 1.4, Math.random() * Math.PI, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

// Inner plank field: 6 vertical planks with individual tone + grain + dark gaps.
function plankField(g: Ctx, s: number, base: RGB): void {
  const m = FRAME_MARGIN;
  const inner = s - m * 2;
  const planks = 6;
  const pw = inner / planks;
  for (let i = 0; i < planks; i++) {
    const px = m + i * pw;
    g.fillStyle = shade(base, 0.9 + Math.random() * 0.2);
    g.fillRect(px, m, pw, inner);
    woodGrain(g, px, m, pw, inner, true, base, 16);
    // Plank edge shading + dark gap.
    g.fillStyle = 'rgba(255,240,200,0.10)';
    g.fillRect(px + 1, m, 2, inner);
    g.fillStyle = 'rgba(46,32,14,0.7)';
    g.fillRect(px + pw - 2.5, m, 2.5, inner);
  }
}

// Thick outer frame with end-grain corners and bevel lines.
function crateFrame(g: Ctx, s: number, base: RGB): void {
  const m = FRAME_MARGIN;
  const frameTone: RGB = [Math.round(base[0] * 0.94), Math.round(base[1] * 0.9), Math.round(base[2] * 0.86)];
  g.fillStyle = shade(frameTone, 1);
  g.fillRect(0, 0, s, m); // top
  g.fillRect(0, s - m, s, m); // bottom
  g.fillRect(0, 0, m, s); // left
  g.fillRect(s - m, 0, m, s); // right
  woodGrain(g, m, 0, s - m * 2, m, false, frameTone, 8);
  woodGrain(g, m, s - m, s - m * 2, m, false, frameTone, 8);
  woodGrain(g, 0, m, m, s - m * 2, true, frameTone, 8);
  woodGrain(g, s - m, m, m, s - m * 2, true, frameTone, 8);

  // End-grain corner blocks: slightly darker with concentric ring arcs.
  for (const [cx, cy] of [[0, 0], [s - m, 0], [0, s - m], [s - m, s - m]] as const) {
    g.fillStyle = shade(frameTone, 0.82);
    g.fillRect(cx, cy, m, m);
    g.strokeStyle = rgba([60, 42, 18], 0.4);
    g.lineWidth = 1;
    for (let r = 4; r < m; r += 6) {
      g.beginPath();
      g.arc(cx + m / 2, cy + m / 2, r, 0, Math.PI * 2);
      g.stroke();
    }
  }

  // Bevel: light outer edge, dark seam against the plank field.
  g.strokeStyle = 'rgba(255,238,196,0.22)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, s - 2, s - 2);
  g.strokeStyle = 'rgba(40,26,10,0.6)';
  g.lineWidth = 2;
  g.strokeRect(m - 1, m - 1, s - (m - 1) * 2, s - (m - 1) * 2);
}

// Dark metal L-bracket with 2 rivets, drawn at each corner.
function cornerBrackets(g: Ctx, s: number): void {
  const arm = 46;
  const t = 13;
  const inset = 6;
  const corners: Array<[number, number, number, number]> = [
    [inset, inset, 1, 1],
    [s - inset, inset, -1, 1],
    [inset, s - inset, 1, -1],
    [s - inset, s - inset, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    g.fillStyle = '#3b3833';
    g.fillRect(Math.min(x, x + sx * arm), Math.min(y, y + sy * t), arm, t);
    g.fillRect(Math.min(x, x + sx * t), Math.min(y, y + sy * arm), t, arm);
    // Worn metal highlight along the outer edge.
    g.fillStyle = 'rgba(150,146,134,0.30)';
    g.fillRect(Math.min(x, x + sx * arm), Math.min(y, y + sy * 2), arm, 2);
    g.fillRect(Math.min(x, x + sx * 2), Math.min(y, y + sy * arm), 2, arm);
    // 2 rivets, one per arm.
    for (const [rx, ry] of [[x + sx * (arm - 12), y + sy * (t / 2 + 0.5)], [x + sx * (t / 2 + 0.5), y + sy * (arm - 12)]] as const) {
      g.fillStyle = '#23211d';
      g.beginPath();
      g.arc(rx, ry, 3.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#7d7a6f';
      g.beginPath();
      g.arc(rx - 0.8, ry - 0.8, 2, 0, Math.PI * 2);
      g.fill();
    }
  }
}

// Black stenciled marking, slightly rotated, low opacity, partially worn.
function stencil(g: Ctx, s: number, text: string, base: RGB): void {
  g.save();
  g.translate(s / 2, s / 2 + 26);
  g.rotate(-3.5 * (Math.PI / 180));
  g.font = 'bold 38px "Courier New", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(20,16,10,0.55)';
  g.fillText(text, 0, 0);
  // Wear: flecks of plank color eat into the lettering.
  const tw = g.measureText(text).width;
  for (let i = 0; i < 110; i++) {
    g.fillStyle = rgba(base, 0.45 + Math.random() * 0.35);
    g.fillRect(-tw / 2 + Math.random() * tw, -19 + Math.random() * 38, 1 + Math.random() * 2.4, 1 + Math.random() * 2);
  }
  g.restore();
}

export function crateSideTexture(variant: number): THREE.CanvasTexture {
  const s = 512;
  const { canvas, g } = createCanvas(s, s);
  const base = crateBase(variant);

  plankField(g, s, base);
  crateFrame(g, s, base);

  // X-brace: two crossing diagonal boards between the inner frame corners.
  const m = FRAME_MARGIN;
  const half = Math.SQRT2 * (s / 2 - m) + 6;
  const bw = 46;
  const braceTone: RGB = [Math.round(base[0] * 0.97), Math.round(base[1] * 0.95), Math.round(base[2] * 0.9)];
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    g.save();
    g.translate(s / 2, s / 2);
    g.rotate(angle);
    // Soft shadow cast under the board edges.
    g.fillStyle = 'rgba(38,26,12,0.30)';
    g.fillRect(-half, -bw / 2 - 4, half * 2, bw + 8);
    // The board itself.
    g.fillStyle = shade(braceTone, 1.02);
    g.fillRect(-half, -bw / 2, half * 2, bw);
    woodGrain(g, -half, -bw / 2, half * 2, bw, false, braceTone, 12);
    // Edge highlight + lower edge shade.
    g.fillStyle = 'rgba(255,238,198,0.25)';
    g.fillRect(-half, -bw / 2, half * 2, 2.5);
    g.fillStyle = 'rgba(40,26,10,0.45)';
    g.fillRect(-half, bw / 2 - 2.5, half * 2, 2.5);
    g.restore();
  }

  cornerBrackets(g, s);

  if (variant % 3 === 0) stencil(g, s, 'SUPPLY 7.62', base);
  if (variant % 3 === 2) stencil(g, s, '38-AC', base);

  return toTexture(canvas);
}

export function crateTopTexture(variant: number): THREE.CanvasTexture {
  const s = 512;
  const { canvas, g } = createCanvas(s, s);
  const base = crateBase(variant);

  plankField(g, s, base);
  crateFrame(g, s, base);
  cornerBrackets(g, s);

  // Scuffs and scratches from gear dragged across the lid.
  g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x = 60 + Math.random() * (s - 120);
    const y = 60 + Math.random() * (s - 120);
    const len = 30 + Math.random() * 90;
    const a = Math.random() * Math.PI;
    const light = Math.random() < 0.5;
    g.strokeStyle = light ? 'rgba(235,214,170,0.30)' : 'rgba(52,36,16,0.30)';
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(
      x + Math.cos(a) * len * 0.5 + (Math.random() - 0.5) * 14,
      y + Math.sin(a) * len * 0.5 + (Math.random() - 0.5) * 14,
      x + Math.cos(a) * len,
      y + Math.sin(a) * len
    );
    g.stroke();
  }
  // A couple of broad pale scuff patches.
  for (let i = 0; i < 3; i++) {
    wrappedBlob(g, s, s, 80 + Math.random() * (s - 160), 80 + Math.random() * (s - 160), 24 + Math.random() * 30, [228, 206, 162], 0.10);
  }

  return toTexture(canvas);
}

// ---------------------------------------------------------------------------
// Metal crate — olive-drab military box.
// ---------------------------------------------------------------------------

export function metalCrateTexture(): THREE.CanvasTexture {
  const s = 512;
  const { canvas, g } = createCanvas(s, s);
  const base: RGB = [90, 87, 66];

  // Painted metal base with a slight vertical sheen.
  const grad = g.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, shade(base, 1.08));
  grad.addColorStop(0.5, shade(base, 0.98));
  grad.addColorStop(1, shade(base, 0.88));
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);

  // Paint mottling + noise.
  for (let i = 0; i < 16; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 36 + Math.random() * 70, [112, 108, 84], 0.06);
  }
  for (let i = 0; i < 12; i++) {
    wrappedBlob(g, s, s, Math.random() * s, Math.random() * s, 30 + Math.random() * 60, [62, 60, 44], 0.06);
  }
  speckle(g, s, s, 700, ['#565340', '#646049', '#4e4b3a', '#6b6750'], 0.3, 1.2);

  // Recessed rectangular panel field.
  const inset = 72;
  const iw = s - inset * 2;
  g.fillStyle = shade(base, 0.92);
  g.fillRect(inset, inset, iw, iw);
  // Recess bevel: dark on top/left (shadow), lighter inset border on bottom/right.
  g.fillStyle = 'rgba(28,26,18,0.55)';
  g.fillRect(inset, inset, iw, 3);
  g.fillRect(inset, inset, 3, iw);
  g.fillStyle = 'rgba(178,174,148,0.40)';
  g.fillRect(inset, inset + iw - 3, iw, 3);
  g.fillRect(inset + iw - 3, inset, 3, iw);
  // Lighter framing line just outside the recess.
  g.strokeStyle = 'rgba(168,164,138,0.35)';
  g.lineWidth = 2;
  g.strokeRect(inset - 5, inset - 5, iw + 10, iw + 10);

  // Rivet rows along all four edges.
  const edge = 22;
  const step = 38;
  const rivet = (x: number, y: number): void => {
    g.fillStyle = 'rgba(24,22,16,0.8)';
    g.beginPath();
    g.arc(x + 1, y + 1.2, 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#73705a';
    g.beginPath();
    g.arc(x, y, 3.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#9b977d';
    g.beginPath();
    g.arc(x - 1, y - 1, 1.6, 0, Math.PI * 2);
    g.fill();
  };
  for (let x = step / 2; x < s; x += step) {
    rivet(x, edge);
    rivet(x, s - edge);
  }
  for (let y = edge + step; y < s - edge - step / 2; y += step) {
    rivet(edge, y);
    rivet(s - edge, y);
  }

  // Scratches revealing lighter bare metal.
  g.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const x = 30 + Math.random() * (s - 60);
    const y = 30 + Math.random() * (s - 60);
    const a = Math.random() * Math.PI;
    const len = 18 + Math.random() * 70;
    g.strokeStyle = `rgba(158,154,128,${0.25 + Math.random() * 0.3})`;
    g.lineWidth = 0.7 + Math.random() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }

  // Rust speckle concentrated toward the bottom edge.
  for (let i = 0; i < 260; i++) {
    const t = Math.pow(Math.random(), 2.2);
    const y = s - 4 - t * 80;
    const x = Math.random() * s;
    const r = 0.5 + Math.random() * 1.8;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(110,74,44,0.45)' : 'rgba(125,84,48,0.35)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // Faded white stencil code on the recessed panel.
  g.save();
  g.translate(s / 2, s / 2);
  g.rotate(-2 * (Math.PI / 180));
  g.font = 'bold 42px "Courier New", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(228,225,210,0.32)';
  g.fillText('MUN-12 / 5.56', 0, -8);
  g.font = 'bold 26px "Courier New", monospace';
  g.fillText('GROSS 41 KG', 0, 30);
  // Wear flecks over the lettering.
  for (let i = 0; i < 90; i++) {
    g.fillStyle = rgba(base, 0.5 + Math.random() * 0.3);
    g.fillRect(-150 + Math.random() * 300, -28 + Math.random() * 72, 1 + Math.random() * 2.4, 1 + Math.random() * 2);
  }
  g.restore();

  return toTexture(canvas);
}
