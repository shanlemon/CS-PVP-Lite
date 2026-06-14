import * as THREE from 'three';

const baseTextures = new Map<string, THREE.CanvasTexture>();
const materials = new Map<string, THREE.MeshStandardMaterial>();

function sharedTexture(name: string, make: () => THREE.CanvasTexture): THREE.CanvasTexture {
  let tex = baseTextures.get(name);
  if (!tex) {
    tex = make();
    baseTextures.set(name, tex);
  }
  return tex;
}

interface TexturedMaterialOpts {
  roughness?: number;
  metalness?: number;
  tint?: number;
}

export function texturedMaterial(
  name: string,
  make: () => THREE.CanvasTexture,
  repeatX: number,
  repeatY: number,
  opts: TexturedMaterialOpts = {},
): THREE.MeshStandardMaterial {
  const roughness = opts.roughness ?? 0.95;
  const metalness = opts.metalness ?? 0;
  const key = `${name}|${repeatX.toFixed(3)}|${repeatY.toFixed(3)}|${opts.tint ?? -1}|${roughness}|${metalness}`;
  let mat = materials.get(key);
  if (!mat) {
    const tex = sharedTexture(name, make).clone();
    tex.repeat.set(repeatX, repeatY);
    tex.needsUpdate = true;
    mat = new THREE.MeshStandardMaterial({ map: tex, roughness, metalness });
    if (opts.tint !== undefined) mat.color.setHex(opts.tint);
    materials.set(key, mat);
  }
  return mat;
}

export function cachedMaterial(
  key: string,
  create: () => THREE.MeshStandardMaterial,
): THREE.MeshStandardMaterial {
  let mat = materials.get(key);
  if (!mat) {
    mat = create();
    materials.set(key, mat);
  }
  return mat;
}
