import * as THREE from 'three';
import { makeCanvasPair as makeCanvas } from './canvas.js';

const shadowMatCache = new Map<number, THREE.MeshBasicMaterial>();

/** Fake AO decal to drop under crates/items. Caller positions it just above ground. */
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
      polygonOffsetFactor: -1,
    });
    shadowMatCache.set(key, mat);
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.45, d * 1.45), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}
