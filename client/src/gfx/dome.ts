import * as THREE from 'three';

import {
  lazy,
  makeCanvasPair as makeCanvas,
  mulberry32,
  toRepeatingTexture as toTexture,
} from './canvas.js';
import { archPath, blob, cracks, paintStucco, speckle, streaks } from './propPaint.js';
import { getTrimMaterial } from './trimMaterial.js';

const getDomeMaterials = lazy(() => {
  const [dc, dctx] = makeCanvas(256, 256);
  const rd = mulberry32(404);
  paintStucco(dctx, 256, 256, rd, '#c7ab7e', '228,206,168', '146,118,82');
  cracks(dctx, 256, 256, rd, 6, '110,88,58', 0.3);
  archPath(dctx, 128, 116, 70, 106);
  dctx.fillStyle = '#ddc89f';
  dctx.fill();
  archPath(dctx, 128, 122, 56, 100);
  dctx.fillStyle = '#262016';
  dctx.fill();
  dctx.save();
  archPath(dctx, 128, 122, 56, 100);
  dctx.clip();
  const wg = dctx.createLinearGradient(0, 150, 0, 222);
  wg.addColorStop(0, 'rgba(0,0,0,0)');
  wg.addColorStop(1, 'rgba(122,100,66,0.3)');
  dctx.fillStyle = wg;
  dctx.fillRect(72, 122, 112, 100);
  dctx.restore();
  dctx.fillStyle = '#d6c096';
  dctx.fillRect(88, 222, 80, 9);
  dctx.fillStyle = 'rgba(70,55,35,0.45)';
  dctx.fillRect(88, 231, 80, 4);
  blob(dctx, 128, 244, 50, '104,84,56', 0.2);
  const drum = new THREE.MeshStandardMaterial({
    map: toTexture(dc, 5, 1),
    roughness: 0.95,
    metalness: 0,
  });

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
      0.06 + ro() * 0.09,
    );
  }
  speckle(octx, 512, 256, ro, 1500, ['52,66,105', '17,24,45'], 1, 2, 0.12);
  const gold = '201,166,107';
  for (let i = 0; i < 16; i++) {
    const x = i * 32 + 16;
    const g = octx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, `rgba(${gold},0)`);
    g.addColorStop(0.35, `rgba(${gold},0.25)`);
    g.addColorStop(0.8, `rgba(${gold},0.85)`);
    octx.fillStyle = g;
    octx.fillRect(x - 1.2, 6, 2.4, 200);
  }
  octx.fillStyle = `rgba(${gold},0.9)`;
  octx.fillRect(0, 206, 512, 2);
  octx.fillRect(0, 212, 512, 1);
  octx.fillRect(0, 240, 512, 2.5);
  octx.fillRect(0, 248, 512, 1.5);
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
    metalness: 0,
  });

  const gold3 = new THREE.MeshStandardMaterial({
    color: '#c2983f',
    roughness: 0.38,
    metalness: 0.35,
  });

  return { drum, dome, gold: gold3 };
});

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
    getTrimMaterial(),
  );
  cornice.position.y = 4.06;
  cornice.castShadow = true;
  group.add(cornice);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3.1, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    mats.dome,
  );
  dome.position.y = 4.12;
  dome.castShadow = true;
  dome.receiveShadow = true;
  group.add(dome);

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
