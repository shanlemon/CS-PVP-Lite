import * as THREE from 'three';

import {
  lazy,
  makeCanvasPair as makeCanvas,
  mulberry32,
  toRepeatingTexture as toTexture,
} from './canvas.js';
import { blob, cracks, paintStucco, speckle } from './propPaint.js';

const getDoorwayMaterials = lazy(() => {
  const rand = mulberry32(901);

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
    metalness: 0,
  });

  const [oc, octx] = makeCanvas(64, 128);
  const og = octx.createLinearGradient(0, 0, 0, 128);
  og.addColorStop(0, '#0a0907');
  og.addColorStop(0.6, '#15110c');
  og.addColorStop(1, '#3a3020');
  octx.fillStyle = og;
  octx.fillRect(0, 0, 64, 128);
  speckle(octx, 64, 128, rand, 130, ['72,60,40'], 1, 2, 0.12);
  const opening = new THREE.MeshBasicMaterial({ map: toTexture(oc, 1, 1) });

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
  actx.strokeStyle = 'rgba(240,230,205,0.5)';
  actx.lineWidth = 3;
  actx.beginPath();
  actx.ellipse(128, 132, 124, 104, 0, Math.PI, 2 * Math.PI);
  actx.stroke();
  actx.fillStyle = '#0d0b08';
  actx.beginPath();
  actx.ellipse(128, 132, 122, 100, 0, Math.PI, 2 * Math.PI);
  actx.closePath();
  actx.fill();
  const arch = new THREE.MeshStandardMaterial({
    map: toTexture(ac, 1, 1),
    roughness: 0.95,
    metalness: 0,
  });

  const [tc, tctx] = makeCanvas(128, 64);
  paintStucco(tctx, 128, 64, rand, '#cdbb94', '226,212,180', '140,118,86');
  blob(tctx, 64, 32, 46, '92,76,52', 0.35);
  speckle(tctx, 128, 64, rand, 260, ['92,76,52', '226,212,180'], 1, 2, 0.2);
  const threshold = new THREE.MeshStandardMaterial({
    map: toTexture(tc, 1, 1),
    roughness: 1,
    metalness: 0,
  });

  return { stone, opening, arch, threshold };
});

/**
 * Decorative arched doorway to mount flush on a wall face. Faces +Z, total
 * depth <= 0.15, origin at the ground in the middle of the opening.
 */
export function makeDoorway(width = 1.7, height = 2.7): THREE.Group {
  const group = new THREE.Group();
  const mats = getDoorwayMaterials();

  const opening = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mats.opening);
  opening.position.set(0, height / 2, 0.02);
  group.add(opening);

  const archH = 0.5;
  const arch = new THREE.Mesh(new THREE.BoxGeometry(width, archH, 0.1), [
    mats.stone,
    mats.stone,
    mats.stone,
    mats.stone,
    mats.arch,
    mats.stone,
  ]);
  arch.position.set(0, height + archH / 2, 0.05);
  group.add(arch);

  const jambH = height + archH;
  for (const sx of [-1, 1]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.22, jambH, 0.14), mats.stone);
    jamb.position.set(sx * (width / 2 + 0.11), jambH / 2, 0.07);
    group.add(jamb);
  }
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.66, 0.32, 0.14),
    mats.stone,
  );
  lintel.position.set(0, jambH + 0.16, 0.07);
  group.add(lintel);

  const step = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.5, 0.07, 0.15),
    mats.threshold,
  );
  step.position.set(0, 0.035, 0.075);
  group.add(step);

  return group;
}
