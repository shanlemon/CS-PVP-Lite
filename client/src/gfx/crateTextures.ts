import type * as THREE from 'three';
import { createCanvas2d as createCanvas, toRepeatingTexture as toTexture } from './canvas.js';
import { rgba, scaled, shade, speckle, wrappedBlob, type Ctx, type RGB } from './texturePaint.js';

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
      y + Math.sin(a) * len,
    );
    g.stroke();
  }
  // A couple of broad pale scuff patches.
  for (let i = 0; i < 3; i++) {
    wrappedBlob(g, s, s, 80 + Math.random() * (s - 160), 80 + Math.random() * (s - 160), 24 + Math.random() * 30, [228, 206, 162], 0.10);
  }

  return toTexture(canvas);
}

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
