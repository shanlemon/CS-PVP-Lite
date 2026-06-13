import * as THREE from 'three';

/**
 * Procedural decoration props for the Dust2 / aim_map graphics overhaul:
 * palms, the navy mosque dome, skyline building blocks, decorative doorways
 * and fake contact shadows.
 *
 * Every texture is painted on an HTML canvas inside this file — no external
 * assets, no new dependencies. Shared materials/textures are created lazily
 * once and reused across every prop instance.
 */

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------

/** Deterministic, cheap PRNG so props look identical every load. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lazy<T>(create: () => T): () => T {
  let value: T | undefined;
  return () => (value === undefined ? (value = create()) : value);
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('props.ts: 2d canvas context unavailable');
  return [canvas, ctx];
}

function toTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------------------
// canvas paint passes (rgb strings are 'r,g,b' so gradients can fade cleanly)
// ---------------------------------------------------------------------------

/** Soft radial blob that fades to transparent without dark halos. */
function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  a: number
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Fine grain noise pass. */
function speckle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  count: number,
  rgbs: string[],
  sizeMin: number,
  sizeMax: number,
  alpha: number
): void {
  for (let i = 0; i < count; i++) {
    const rgb = rgbs[Math.floor(rand() * rgbs.length)];
    ctx.fillStyle = `rgba(${rgb},${alpha * (0.35 + rand() * 0.65)})`;
    const s = sizeMin + rand() * (sizeMax - sizeMin);
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
}

/** Faint vertical weathering streaks. */
function streaks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  count: number,
  rgb: string,
  alpha: number
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
function cracks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  count: number,
  rgb: string,
  alpha: number
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
function paintStucco(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  base: string,
  lightRgb: string,
  darkRgb: string
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
      0.05 + rand() * 0.08
    );
  }
  speckle(ctx, w, h, rand, Math.round((w * h) / 90), [lightRgb, darkRgb], 1, 2.2, 0.16);
  streaks(ctx, w, h, rand, 12, darkRgb, 0.07);
}

/** Round-topped (arched) window/door path. */
function archPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  w: number,
  h: number
): void {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx - r, top + h);
  ctx.lineTo(cx - r, top + r);
  ctx.arc(cx, top + r, r, Math.PI, 0);
  ctx.lineTo(cx + r, top + h);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// shared materials — palm
// ---------------------------------------------------------------------------

const getTrunkMaterial = lazy(() => {
  const [canvas, ctx] = makeCanvas(128, 256);
  const rand = mulberry32(77);
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(0, 0, 128, 256);
  // horizontal ring bands with rough edges (old frond scars)
  let y = 0;
  let light = true;
  while (y < 256) {
    const bandH = 11 + rand() * 11;
    const a = 0.45 + rand() * 0.3;
    ctx.fillStyle = light ? `rgba(176,146,102,${a})` : `rgba(94,70,45,${a})`;
    ctx.fillRect(0, y, 128, bandH);
    for (let x = 0; x < 128; x += 3 + Math.floor(rand() * 4)) {
      const notch = rand() * 4;
      ctx.fillRect(x, y - notch, 3, notch);
    }
    ctx.fillStyle = 'rgba(48,34,20,0.5)';
    ctx.fillRect(0, y + bandH - 1.5, 128, 1.5);
    y += bandH;
    light = !light;
  }
  speckle(ctx, 128, 256, rand, 600, ['56,42,26', '186,156,110'], 1, 2.4, 0.28);
  streaks(ctx, 128, 256, rand, 22, '50,38,24', 0.15);
  return new THREE.MeshStandardMaterial({
    map: toTexture(canvas, 1, 1),
    roughness: 1,
    metalness: 0
  });
});

interface FrondPalette {
  rib: string;
  dark: string;
  light: string;
}

function makeFrondTexture(p: FrondPalette, seed: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 128);
  const rand = mulberry32(seed);
  const mid = 64;
  ctx.lineCap = 'round';
  // leaflets in two passes (dark back fill, lighter ragged front), angled
  // away from the rib and leaning toward the tip; gaps give jagged alpha edges
  for (let pass = 0; pass < 2; pass++) {
    let x = 10 + rand() * 4;
    while (x < 248) {
      const t = x / 256;
      const ramp = Math.min(t / 0.14, 1); // bare stem near the base
      let len = 52 * ramp * (1 - 0.55 * t) * (0.7 + rand() * 0.5);
      if (rand() < 0.09) len *= 0.4; // occasional torn/short leaflet
      len = Math.min(len, 56);
      const lean = 14 + 30 * t + rand() * 8;
      for (const s of [-1, 1]) {
        ctx.strokeStyle = pass === 0 ? p.dark : rand() < 0.55 ? p.light : p.dark;
        ctx.lineWidth = pass === 0 ? 4.6 : 2.6 + rand() * 1.8;
        ctx.beginPath();
        ctx.moveTo(x, mid + s * 1.5);
        ctx.quadraticCurveTo(
          x + lean * 0.45,
          mid + s * (2 + len * 0.5),
          x + lean + (pass === 0 ? 2 : 0),
          mid + s * (3 + len)
        );
        ctx.stroke();
      }
      x += pass === 0 ? 7 + rand() * 3 : 4.5 + rand() * 3;
    }
  }
  // center rib on top, tapering toward the tip
  ctx.fillStyle = p.rib;
  ctx.beginPath();
  ctx.moveTo(0, mid - 5);
  ctx.lineTo(250, mid - 1.4);
  ctx.lineTo(256, mid);
  ctx.lineTo(250, mid + 1.4);
  ctx.lineTo(0, mid + 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,225,160,0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, mid - 1.6);
  ctx.lineTo(248, mid - 0.4);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping; // not tileable — clamp so the alpha
  tex.wrapT = THREE.ClampToEdgeWrapping; // cutout never bleeds across edges
  tex.anisotropy = 4;
  return tex;
}

function frondMaterial(p: FrondPalette, seed: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: makeFrondTexture(p, seed),
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0
  });
}

const getFrondMaterials = lazy(() => {
  const palettes: FrondPalette[] = [
    { rib: '#3a5520', dark: '#4c6e2a', light: '#7d9c4b' },
    { rib: '#41601f', dark: '#587b31', light: '#8fae57' },
    { rib: '#314a1d', dark: '#456325', light: '#6f8e41' }
  ];
  return palettes.map((p, i) => frondMaterial(p, 500 + i * 131));
});

const getDeadFrondMaterial = lazy(() =>
  frondMaterial({ rib: '#5e4423', dark: '#7c5c30', light: '#9a7a42' }, 941)
);

// ---------------------------------------------------------------------------
// shared materials — trim / dome / building / doorway
// ---------------------------------------------------------------------------

/** Darker tan trim, shared by building parapets and the dome cornice. */
const getTrimMaterial = lazy(() => {
  const [canvas, ctx] = makeCanvas(64, 64);
  paintStucco(ctx, 64, 64, mulberry32(323), '#a8895f', '190,165,125', '118,94,64');
  return new THREE.MeshStandardMaterial({
    map: toTexture(canvas, 1, 1),
    roughness: 0.95,
    metalness: 0
  });
});

const getDomeMaterials = lazy(() => {
  // --- drum: tan stucco with a dark arched window, tiled 5x around ---
  const [dc, dctx] = makeCanvas(256, 256);
  const rd = mulberry32(404);
  paintStucco(dctx, 256, 256, rd, '#c7ab7e', '228,206,168', '146,118,82');
  cracks(dctx, 256, 256, rd, 6, '110,88,58', 0.3);
  archPath(dctx, 128, 116, 70, 106); // light stone surround
  dctx.fillStyle = '#ddc89f';
  dctx.fill();
  archPath(dctx, 128, 122, 56, 100); // dark recessed opening
  dctx.fillStyle = '#262016';
  dctx.fill();
  dctx.save(); // faint dusty bounce light low in the opening
  archPath(dctx, 128, 122, 56, 100);
  dctx.clip();
  const wg = dctx.createLinearGradient(0, 150, 0, 222);
  wg.addColorStop(0, 'rgba(0,0,0,0)');
  wg.addColorStop(1, 'rgba(122,100,66,0.3)');
  dctx.fillStyle = wg;
  dctx.fillRect(72, 122, 112, 100);
  dctx.restore();
  dctx.fillStyle = '#d6c096'; // sill
  dctx.fillRect(88, 222, 80, 9);
  dctx.fillStyle = 'rgba(70,55,35,0.45)';
  dctx.fillRect(88, 231, 80, 4);
  blob(dctx, 128, 244, 50, '104,84,56', 0.2); // grime under the sill
  const drum = new THREE.MeshStandardMaterial({
    map: toTexture(dc, 5, 1),
    roughness: 0.95,
    metalness: 0
  });

  // --- dome: deep navy with tan/gold pattern bands (canvas top = pole) ---
  const [oc, octx] = makeCanvas(512, 256);
  const ro = mulberry32(505);
  octx.fillStyle = '#1f2a4a';
  octx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 30; i++) {
    blob(
      octx,
      ro() * 512,
      ro() * 256,
      40 + ro() * 90,
      ro() < 0.5 ? '46,60,99' : '22,31,58',
      0.06 + ro() * 0.09
    );
  }
  speckle(octx, 512, 256, ro, 1500, ['52,66,105', '17,24,45'], 1, 2, 0.12);
  const gold = '201,166,107';
  // vertical meridian lines fading toward the pole
  for (let i = 0; i < 16; i++) {
    const x = i * 32 + 16;
    const g = octx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, `rgba(${gold},0)`);
    g.addColorStop(0.35, `rgba(${gold},0.25)`);
    g.addColorStop(0.8, `rgba(${gold},0.85)`);
    octx.fillStyle = g;
    octx.fillRect(x - 1.2, 6, 2.4, 200);
  }
  // pinstripes near the base
  octx.fillStyle = `rgba(${gold},0.9)`;
  octx.fillRect(0, 206, 512, 2);
  octx.fillRect(0, 212, 512, 1);
  octx.fillRect(0, 240, 512, 2.5);
  octx.fillRect(0, 248, 512, 1.5);
  // arabesque band: small diamonds with dots between
  for (let x = 0; x < 512; x += 20) {
    const cx = x + 10;
    const cy = 226;
    octx.fillStyle = `rgba(${gold},0.95)`;
    octx.beginPath();
    octx.moveTo(cx, cy - 7);
    octx.lineTo(cx + 5.5, cy);
    octx.lineTo(cx, cy + 7);
    octx.lineTo(cx - 5.5, cy);
    octx.closePath();
    octx.fill();
    octx.beginPath();
    octx.arc(x, cy, 1.7, 0, Math.PI * 2);
    octx.fill();
  }
  streaks(octx, 512, 256, ro, 16, '12,18,34', 0.12);
  const dome = new THREE.MeshStandardMaterial({
    map: toTexture(oc, 1, 1),
    roughness: 0.8,
    metalness: 0
  });

  const gold3 = new THREE.MeshStandardMaterial({
    color: '#c2983f',
    roughness: 0.38,
    metalness: 0.35
  });

  return { drum, dome, gold: gold3 };
});

const getBuildingMaterials = lazy(() => {
  const base = '#c9ad80';
  const lightRgb = '226,204,168';
  const darkRgb = '148,120,86';

  // walls with 3 dark windows painted in
  const [wc, wctx] = makeCanvas(256, 256);
  const rw = mulberry32(311);
  paintStucco(wctx, 256, 256, rw, base, lightRgb, darkRgb);
  const gg = wctx.createLinearGradient(0, 196, 0, 256);
  gg.addColorStop(0, 'rgba(105,84,58,0)');
  gg.addColorStop(1, 'rgba(105,84,58,0.35)');
  wctx.fillStyle = gg;
  wctx.fillRect(0, 196, 256, 60);
  for (const cx of [52, 128, 204]) {
    const wW = 30;
    const wH = 52;
    const top = 92;
    wctx.fillStyle = '#d9c49c'; // light surround
    wctx.fillRect(cx - wW / 2 - 3, top - 3, wW + 6, wH + 6);
    wctx.fillStyle = '#241d13'; // dark opening
    wctx.fillRect(cx - wW / 2, top, wW, wH);
    const ig = wctx.createLinearGradient(0, top, 0, top + wH);
    ig.addColorStop(0, 'rgba(0,0,0,0.5)');
    ig.addColorStop(1, 'rgba(120,100,70,0.25)');
    wctx.fillStyle = ig;
    wctx.fillRect(cx - wW / 2, top, wW, wH);
    wctx.fillStyle = 'rgba(90,72,48,0.3)'; // weather streak under the sill
    wctx.fillRect(cx - wW / 2, top + wH + 4, wW, 12);
  }
  const wall = new THREE.MeshStandardMaterial({
    map: toTexture(wc, 1, 1),
    roughness: 0.98,
    metalness: 0
  });

  // plain mottled sides / roof
  const [pc, pctx] = makeCanvas(128, 128);
  paintStucco(pctx, 128, 128, mulberry32(317), base, lightRgb, darkRgb);
  const plain = new THREE.MeshStandardMaterial({
    map: toTexture(pc, 1, 1),
    roughness: 0.98,
    metalness: 0
  });

  return { wall, plain, parapet: getTrimMaterial() };
});

const getDoorwayMaterials = lazy(() => {
  const rand = mulberry32(901);

  // sand-stone frame with painted joint lines + cracks + edge wear
  const [sc, sctx] = makeCanvas(256, 256);
  paintStucco(sctx, 256, 256, rand, '#d8c8a6', '232,220,194', '150,128,96');
  sctx.strokeStyle = 'rgba(110,92,66,0.6)';
  sctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    sctx.beginPath();
    sctx.moveTo(0, y + 1);
    sctx.lineTo(256, y + 1);
    sctx.stroke();
    const off = row % 2 === 0 ? 32 : 80;
    for (let x = off; x < 256; x += 96) {
      const jx = x + (rand() - 0.5) * 4;
      sctx.beginPath();
      sctx.moveTo(jx, y);
      sctx.lineTo(jx, y + 64);
      sctx.stroke();
    }
  }
  cracks(sctx, 256, 256, rand, 8, '110,92,66', 0.4);
  for (let i = 0; i < 8; i++) {
    blob(sctx, rand() * 256, rand() * 256, 18 + rand() * 26, '128,106,76', 0.14);
  }
  const stone = new THREE.MeshStandardMaterial({
    map: toTexture(sc, 1, 1),
    roughness: 0.95,
    metalness: 0
  });

  // near-black recessed opening, lighter at the bottom (dust bounce light)
  const [oc, octx] = makeCanvas(64, 128);
  const og = octx.createLinearGradient(0, 0, 0, 128);
  og.addColorStop(0, '#0a0907');
  og.addColorStop(0.6, '#15110c');
  og.addColorStop(1, '#3a3020');
  octx.fillStyle = og;
  octx.fillRect(0, 0, 64, 128);
  speckle(octx, 64, 128, rand, 130, ['72,60,40'], 1, 2, 0.12);
  const opening = new THREE.MeshBasicMaterial({ map: toTexture(oc, 1, 1) });

  // arch piece: stone with radiating voussoir joints and a dark arched cut
  const [ac, actx] = makeCanvas(256, 128);
  paintStucco(actx, 256, 128, rand, '#d8c8a6', '232,220,194', '150,128,96');
  actx.strokeStyle = 'rgba(110,92,66,0.55)';
  actx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    const ang = Math.PI + (i / 8) * Math.PI;
    actx.beginPath();
    actx.moveTo(128, 132);
    actx.lineTo(128 + Math.cos(ang) * 170, 132 + Math.sin(ang) * 170);
    actx.stroke();
  }
  actx.strokeStyle = 'rgba(240,230,205,0.5)'; // light rim above the arch
  actx.lineWidth = 3;
  actx.beginPath();
  actx.ellipse(128, 132, 124, 104, 0, Math.PI, 2 * Math.PI);
  actx.stroke();
  actx.fillStyle = '#0d0b08'; // the shallow dark arch itself
  actx.beginPath();
  actx.ellipse(128, 132, 122, 100, 0, Math.PI, 2 * Math.PI);
  actx.closePath();
  actx.fill();
  const arch = new THREE.MeshStandardMaterial({
    map: toTexture(ac, 1, 1),
    roughness: 0.95,
    metalness: 0
  });

  // worn threshold slab: stone with a darker foot-polished middle
  const [tc, tctx] = makeCanvas(128, 64);
  paintStucco(tctx, 128, 64, rand, '#cdbb94', '226,212,180', '140,118,86');
  blob(tctx, 64, 32, 46, '92,76,52', 0.35);
  speckle(tctx, 128, 64, rand, 260, ['92,76,52', '226,212,180'], 1, 2, 0.2);
  const threshold = new THREE.MeshStandardMaterial({
    map: toTexture(tc, 1, 1),
    roughness: 1,
    metalness: 0
  });

  return { stone, opening, arch, threshold };
});

// ---------------------------------------------------------------------------
// palm
// ---------------------------------------------------------------------------

let palmCounter = 1;

/** Tapered, parabola-bent frond plane. Base at origin, extends along +X. */
function buildFrond(
  mat: THREE.MeshStandardMaterial,
  length: number,
  width: number,
  bend: number
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(length, width, 6, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getX(i) + length / 2) / length;
    const halfW = pos.getY(i);
    // narrow stem near the base, taper toward the tip
    const taper = (0.45 + 0.55 * Math.min(t / 0.18, 1)) * (1 - 0.72 * t);
    pos.setXYZ(i, t * length, -bend * t * t, halfW * taper);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.order = 'ZYX'; // roll about the frond axis, then droop
  mesh.castShadow = true;
  return mesh;
}

/**
 * Curved desert palm, ~7*scale m tall, group origin at the ground.
 * Built at unit scale, then uniformly scaled — identical proportions.
 */
export function makePalm(scale = 1): THREE.Group {
  const group = new THREE.Group();
  const rand = mulberry32(1000 + palmCounter++ * 7919);
  const root = new THREE.Group();
  root.rotation.y = rand() * Math.PI * 2; // every palm leans its own way
  group.add(root);

  const trunkMat = getTrunkMaterial();
  const segs = 6;
  const segH = 1.22;
  const curve = 0.34 + rand() * 0.16; // total lean (radians) at the crown
  const cursor = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    const a0 = curve * Math.pow(i / segs, 1.4);
    const a1 = curve * Math.pow((i + 1) / segs, 1.4);
    const aMid = (a0 + a1) / 2;
    const rBottom = THREE.MathUtils.lerp(0.22, 0.13, i / segs);
    const rTop = THREE.MathUtils.lerp(0.22, 0.13, (i + 1) / segs);
    // slight collar bulge at each segment base reads as ringed palm bark
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom * 1.06, segH * 1.04, 8, 1),
      trunkMat
    );
    dir.set(Math.sin(aMid), Math.cos(aMid), 0);
    seg.position.copy(cursor).addScaledVector(dir, segH / 2);
    seg.rotation.z = -aMid;
    seg.castShadow = true;
    seg.receiveShadow = true;
    root.add(seg);
    cursor.addScaledVector(dir, segH);
  }

  const crown = new THREE.Group();
  crown.position.copy(cursor);
  crown.position.y += 0.08;
  crown.rotation.z = -curve * 0.5;
  root.add(crown);

  const greens = getFrondMaterials();
  const rings = [
    { count: 5, droopMin: 0.05, droopMax: 0.32, bend: 0.6, len: 2.9, lift: 0.14 },
    { count: 6, droopMin: 0.5, droopMax: 0.85, bend: 0.95, len: 2.7, lift: 0.02 }
  ];
  let yawOffset = rand() * Math.PI * 2;
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const holder = new THREE.Group();
      holder.rotation.y = yawOffset + (i / ring.count) * Math.PI * 2 + (rand() - 0.5) * 0.5;
      const mat = greens[Math.floor(rand() * greens.length)];
      const frond = buildFrond(
        mat,
        ring.len * (0.85 + rand() * 0.3),
        0.55,
        ring.bend * (0.8 + rand() * 0.4)
      );
      frond.rotation.z = -(ring.droopMin + rand() * (ring.droopMax - ring.droopMin));
      frond.rotation.x = (rand() - 0.5) * 0.45;
      frond.position.y = ring.lift;
      holder.add(frond);
      crown.add(holder);
    }
    yawOffset += 0.6;
  }

  // dead brown fronds hanging below the crown
  const dead = getDeadFrondMaterial();
  for (let i = 0; i < 3; i++) {
    const holder = new THREE.Group();
    holder.rotation.y = rand() * Math.PI * 2;
    const frond = buildFrond(dead, 1.9 + rand() * 0.5, 0.5, 1.3);
    frond.rotation.z = -(1.45 + rand() * 0.5);
    frond.rotation.x = (rand() - 0.5) * 0.4;
    frond.position.y = -0.06;
    holder.add(frond);
    crown.add(holder);
  }

  // growth point hides frond bases
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), trunkMat);
  core.position.y = 0.04;
  core.castShadow = true;
  crown.add(core);

  group.scale.setScalar(scale);
  return group;
}

// ---------------------------------------------------------------------------
// dome
// ---------------------------------------------------------------------------

/** Navy mosque dome on a tan stucco drum, origin at the ground. */
export function makeDome(): THREE.Group {
  const group = new THREE.Group();
  const mats = getDomeMaterials();

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.06, 4, 16, 1), mats.drum);
  drum.position.y = 2;
  drum.castShadow = true;
  drum.receiveShadow = true;
  group.add(drum);

  const cornice = new THREE.Mesh(
    new THREE.CylinderGeometry(3.24, 3.24, 0.24, 16, 1),
    getTrimMaterial()
  );
  cornice.position.y = 4.06;
  cornice.castShadow = true;
  group.add(cornice);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3.1, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    mats.dome
  );
  dome.position.y = 4.12;
  dome.castShadow = true;
  dome.receiveShadow = true;
  group.add(dome);

  // gold finial: rod + ball + tip
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 8, 1), mats.gold);
  rod.position.y = 7.7;
  rod.castShadow = true;
  group.add(rod);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mats.gold);
  ball.position.y = 8.35;
  ball.castShadow = true;
  group.add(ball);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.06, 0.32, 8, 1), mats.gold);
  tip.position.y = 8.66;
  tip.castShadow = true;
  group.add(tip);

  return group;
}

// ---------------------------------------------------------------------------
// skyline building block
// ---------------------------------------------------------------------------

/** Flat-roofed stucco block for the skyline behind the walls. Origin at ground. */
export function makeBuildingBlock(w: number, h: number, d: number): THREE.Group {
  const group = new THREE.Group();
  const mats = getBuildingMaterials();
  // windows go on the long sides only; box face order: +x,-x,+y,-y,+z,-z
  const faceMats =
    w >= d
      ? [mats.plain, mats.plain, mats.plain, mats.plain, mats.wall, mats.wall]
      : [mats.wall, mats.wall, mats.plain, mats.plain, mats.plain, mats.plain];
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faceMats);
  body.position.y = h / 2;
  body.castShadow = false;
  group.add(body);

  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.2, 0.26, d + 0.2),
    mats.parapet
  );
  parapet.position.y = h + 0.02;
  parapet.castShadow = false;
  group.add(parapet);

  return group;
}

// ---------------------------------------------------------------------------
// doorway
// ---------------------------------------------------------------------------

/**
 * Decorative arched doorway to mount flush on a wall face. Faces +Z, total
 * depth <= 0.15, origin at the ground in the middle of the opening.
 */
export function makeDoorway(width = 1.7, height = 2.7): THREE.Group {
  const group = new THREE.Group();
  const mats = getDoorwayMaterials();

  // dark recessed opening, lighter near the floor
  const opening = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mats.opening);
  opening.position.set(0, height / 2, 0.02);
  group.add(opening);

  // arch piece above the opening — painted dark arch fakes a curved top
  const archH = 0.5;
  const arch = new THREE.Mesh(new THREE.BoxGeometry(width, archH, 0.1), [
    mats.stone,
    mats.stone,
    mats.stone,
    mats.stone,
    mats.arch,
    mats.stone
  ]);
  arch.position.set(0, height + archH / 2, 0.05);
  group.add(arch);

  // stone frame: two jambs + lintel
  const jambH = height + archH;
  for (const sx of [-1, 1]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.22, jambH, 0.14), mats.stone);
    jamb.position.set(sx * (width / 2 + 0.11), jambH / 2, 0.07);
    group.add(jamb);
  }
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.66, 0.32, 0.14),
    mats.stone
  );
  lintel.position.set(0, jambH + 0.16, 0.07);
  group.add(lintel);

  // worn threshold step
  const step = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.5, 0.07, 0.15),
    mats.threshold
  );
  step.position.set(0, 0.035, 0.075);
  group.add(step);

  return group;
}

// ---------------------------------------------------------------------------
// contact shadow
// ---------------------------------------------------------------------------

const shadowMatCache = new Map<number, THREE.MeshBasicMaterial>();

/** Fake AO decal to drop under crates. Caller positions it just above ground. */
export function makeContactShadow(w: number, d: number, opacity = 0.4): THREE.Mesh {
  const key = Math.round(opacity * 1000);
  let mat = shadowMatCache.get(key);
  if (!mat) {
    const [canvas, ctx] = makeCanvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, `rgba(0,0,0,${opacity})`);
    g.addColorStop(0.55, `rgba(0,0,0,${opacity * 0.55})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -1
    });
    shadowMatCache.set(key, mat);
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.45, d * 1.45), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}
