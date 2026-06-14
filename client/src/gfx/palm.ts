import * as THREE from 'three';

import {
  lazy,
  makeCanvasPair as makeCanvas,
  mulberry32,
  toRepeatingTexture as toTexture,
} from './canvas.js';
import { speckle, streaks } from './propPaint.js';

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
    metalness: 0,
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
  // Leaflets in two passes: dark back fill, lighter ragged front.
  for (let pass = 0; pass < 2; pass++) {
    let x = 10 + rand() * 4;
    while (x < 248) {
      const t = x / 256;
      const ramp = Math.min(t / 0.14, 1);
      let len = 52 * ramp * (1 - 0.55 * t) * (0.7 + rand() * 0.5);
      if (rand() < 0.09) len *= 0.4;
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
          mid + s * (3 + len),
        );
        ctx.stroke();
      }
      x += pass === 0 ? 7 + rand() * 3 : 4.5 + rand() * 3;
    }
  }

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
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
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
    metalness: 0,
  });
}

const getFrondMaterials = lazy(() => {
  const palettes: FrondPalette[] = [
    { rib: '#3a5520', dark: '#4c6e2a', light: '#7d9c4b' },
    { rib: '#41601f', dark: '#587b31', light: '#8fae57' },
    { rib: '#314a1d', dark: '#456325', light: '#6f8e41' },
  ];
  return palettes.map((p, i) => frondMaterial(p, 500 + i * 131));
});

const getDeadFrondMaterial = lazy(() =>
  frondMaterial({ rib: '#5e4423', dark: '#7c5c30', light: '#9a7a42' }, 941),
);

let palmCounter = 1;

/** Tapered, parabola-bent frond plane. Base at origin, extends along +X. */
function buildFrond(
  mat: THREE.MeshStandardMaterial,
  length: number,
  width: number,
  bend: number,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(length, width, 6, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getX(i) + length / 2) / length;
    const halfW = pos.getY(i);
    const taper = (0.45 + 0.55 * Math.min(t / 0.18, 1)) * (1 - 0.72 * t);
    pos.setXYZ(i, t * length, -bend * t * t, halfW * taper);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.order = 'ZYX';
  mesh.castShadow = true;
  return mesh;
}

/** Curved desert palm, ~7*scale m tall, group origin at the ground. */
export function makePalm(scale = 1): THREE.Group {
  const group = new THREE.Group();
  const rand = mulberry32(1000 + palmCounter++ * 7919);
  const root = new THREE.Group();
  root.rotation.y = rand() * Math.PI * 2;
  group.add(root);

  const trunkMat = getTrunkMaterial();
  const segs = 6;
  const segH = 1.22;
  const curve = 0.34 + rand() * 0.16;
  const cursor = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    const a0 = curve * Math.pow(i / segs, 1.4);
    const a1 = curve * Math.pow((i + 1) / segs, 1.4);
    const aMid = (a0 + a1) / 2;
    const rBottom = THREE.MathUtils.lerp(0.22, 0.13, i / segs);
    const rTop = THREE.MathUtils.lerp(0.22, 0.13, (i + 1) / segs);
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom * 1.06, segH * 1.04, 8, 1),
      trunkMat,
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
    { count: 6, droopMin: 0.5, droopMax: 0.85, bend: 0.95, len: 2.7, lift: 0.02 },
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
        ring.bend * (0.8 + rand() * 0.4),
      );
      frond.rotation.z = -(ring.droopMin + rand() * (ring.droopMax - ring.droopMin));
      frond.rotation.x = (rand() - 0.5) * 0.45;
      frond.position.y = ring.lift;
      holder.add(frond);
      crown.add(holder);
    }
    yawOffset += 0.6;
  }

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

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), trunkMat);
  core.position.y = 0.04;
  core.castShadow = true;
  crown.add(core);

  group.scale.setScalar(scale);
  return group;
}
