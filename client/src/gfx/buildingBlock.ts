import * as THREE from 'three';

import {
  lazy,
  makeCanvasPair as makeCanvas,
  mulberry32,
  toRepeatingTexture as toTexture,
} from './canvas.js';
import { paintStucco } from './propPaint.js';
import { getTrimMaterial } from './trimMaterial.js';

const getBuildingMaterials = lazy(() => {
  const base = '#c9ad80';
  const lightRgb = '226,204,168';
  const darkRgb = '148,120,86';

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
    wctx.fillStyle = '#d9c49c';
    wctx.fillRect(cx - wW / 2 - 3, top - 3, wW + 6, wH + 6);
    wctx.fillStyle = '#241d13';
    wctx.fillRect(cx - wW / 2, top, wW, wH);
    const ig = wctx.createLinearGradient(0, top, 0, top + wH);
    ig.addColorStop(0, 'rgba(0,0,0,0.5)');
    ig.addColorStop(1, 'rgba(120,100,70,0.25)');
    wctx.fillStyle = ig;
    wctx.fillRect(cx - wW / 2, top, wW, wH);
    wctx.fillStyle = 'rgba(90,72,48,0.3)';
    wctx.fillRect(cx - wW / 2, top + wH + 4, wW, 12);
  }
  const wall = new THREE.MeshStandardMaterial({
    map: toTexture(wc, 1, 1),
    roughness: 0.98,
    metalness: 0,
  });

  const [pc, pctx] = makeCanvas(128, 128);
  paintStucco(pctx, 128, 128, mulberry32(317), base, lightRgb, darkRgb);
  const plain = new THREE.MeshStandardMaterial({
    map: toTexture(pc, 1, 1),
    roughness: 0.98,
    metalness: 0,
  });

  return { wall, plain, parapet: getTrimMaterial() };
});

/** Flat-roofed stucco block for the skyline behind the walls. Origin at ground. */
export function makeBuildingBlock(w: number, h: number, d: number): THREE.Group {
  const group = new THREE.Group();
  const mats = getBuildingMaterials();
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
    mats.parapet,
  );
  parapet.position.y = h + 0.02;
  parapet.castShadow = false;
  group.add(parapet);

  return group;
}
