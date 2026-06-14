import type * as THREE from 'three';
import { createCanvas2d as createCanvas, toRepeatingTexture as toTexture } from './canvas.js';
import { crack, rgba, speckle, wrappedBlob, wrappedDot, type RGB } from './texturePaint.js';
export { crateSideTexture, crateTopTexture, metalCrateTexture } from './crateTextures.js';

// Procedural Dust2-style textures, drawn entirely on HTML canvases.
// No external image files — Discord activity CSP requires self-contained assets.
// Every tileable texture wraps its features across the canvas borders manually.

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