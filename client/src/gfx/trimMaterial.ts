import * as THREE from 'three';

import {
  lazy,
  makeCanvasPair as makeCanvas,
  mulberry32,
  toRepeatingTexture as toTexture,
} from './canvas.js';
import { paintStucco } from './propPaint.js';

/** Darker tan trim, shared by building parapets and the dome cornice. */
export const getTrimMaterial = lazy(() => {
  const [canvas, ctx] = makeCanvas(64, 64);
  paintStucco(ctx, 64, 64, mulberry32(323), '#a8895f', '190,165,125', '118,94,64');
  return new THREE.MeshStandardMaterial({
    map: toTexture(canvas, 1, 1),
    roughness: 0.95,
    metalness: 0,
  });
});
