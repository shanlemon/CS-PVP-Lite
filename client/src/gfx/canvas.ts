import * as THREE from 'three';

export interface Canvas2D {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
}

export function createCanvas2d(w: number, h: number): Canvas2D {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('2d canvas context unavailable');
  return { canvas, g };
}

export function makeCanvasPair(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const { canvas, g } = createCanvas2d(w, h);
  return [canvas, g];
}

export function toRepeatingTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

export function lazy<T>(create: () => T): () => T {
  let value: T | undefined;
  return () => (value === undefined ? (value = create()) : value);
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
