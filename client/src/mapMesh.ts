import * as THREE from 'three';
import { ARENA_HALF_X, ARENA_HALF_Z, SOLIDS, WALL_THICKNESS } from '@cs/shared';
import type { Solid } from '@cs/shared';
import {
  concreteTexture,
  copingTexture,
  crateSideTexture,
  crateTopTexture,
  dirtTexture,
  metalCrateTexture,
  stuccoTexture,
  trimBandTexture,
} from './gfx/textures.js';
import { applyLighting, applySky } from './gfx/sky.js';
import { makeContactShadow } from './gfx/contactShadow.js';
import { addDoorways, addSkyline } from './mapDressing.js';
import { cachedMaterial, texturedMaterial } from './mapMaterials.js';

// Dressed Dust2-style arena. Visual geometry is generated from the same
// SOLIDS data the collision uses, so the two can never drift apart.

// ---------------------------------------------------------------------------
// crates
// ---------------------------------------------------------------------------

/** Stable hash of a crate's footprint, so variants never change between loads. */
function crateSeed(s: Solid): number {
  const a = Math.round(s.box.min.x * 10) | 0;
  const b = Math.round(s.box.min.z * 10) | 0;
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return Math.abs(h);
}

/** 6-material array: sides on ±x/±z, lid texture on ±y. */
function woodCrateMaterials(variant: number): THREE.MeshStandardMaterial[] {
  const v = variant % 3;
  const side = cachedMaterial(`crateSide${v}`, () =>
    new THREE.MeshStandardMaterial({ map: crateSideTexture(v), roughness: 0.85, metalness: 0 }));
  const top = cachedMaterial(`crateTop${v}`, () =>
    new THREE.MeshStandardMaterial({ map: crateTopTexture(v), roughness: 0.85, metalness: 0 }));
  return [side, side, top, top, side, side];
}

function metalCrateMaterial(): THREE.MeshStandardMaterial {
  return cachedMaterial('metalCrate', () =>
    new THREE.MeshStandardMaterial({ map: metalCrateTexture(), roughness: 0.7, metalness: 0.15 }));
}

function addCrate(scene: THREE.Scene, s: Solid): void {
  const w = s.box.max.x - s.box.min.x;
  const h = s.box.max.y - s.box.min.y;
  const d = s.box.max.z - s.box.min.z;
  const cx = (s.box.min.x + s.box.max.x) / 2;
  const cz = (s.box.min.z + s.box.max.z) / 2;
  const seed = crateSeed(s);
  const metal = seed % 4 === 0;
  const variant = seed % 3;

  // Stacked (2x-tall) crates render as two units so the texture never
  // stretches — each unit reads as one crate, exactly like the reference.
  const units = Math.max(1, Math.round(h / w));
  const unitH = h / units;
  const geo = new THREE.BoxGeometry(w, unitH, d);
  for (let i = 0; i < units; i++) {
    const mats: THREE.Material | THREE.Material[] = metal
      ? metalCrateMaterial()
      : woodCrateMaterials(variant + i);
    const mesh = new THREE.Mesh(geo, mats);
    mesh.position.set(cx, s.box.min.y + unitH * (i + 0.5), cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const shadow = makeContactShadow(w, d);
  shadow.position.set(cx, s.box.min.y + 0.012, cz);
  scene.add(shadow);
}

// ---------------------------------------------------------------------------
// walls (stucco body + trim band + base skirt + coping cap)
// ---------------------------------------------------------------------------

function addWall(scene: THREE.Scene, s: Solid): void {
  const w = s.box.max.x - s.box.min.x;
  const h = s.box.max.y - s.box.min.y;
  const d = s.box.max.z - s.box.min.z;
  const cx = (s.box.min.x + s.box.max.x) / 2;
  const cz = (s.box.min.z + s.box.max.z) / 2;
  const alongX = w >= d; // end walls run along x, side walls along z
  const length = alongX ? w : d;
  const t = WALL_THICKNESS;

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    texturedMaterial('stucco', stuccoTexture, length / 4, 1, { roughness: 0.95 }),
  );
  wall.position.set(cx, s.box.min.y + h / 2, cz);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);

  // Plain dark material for the thin ends/top of the trim band boxes.
  const edge = cachedMaterial('trimEdge', () =>
    new THREE.MeshStandardMaterial({ color: 0x352c26, roughness: 0.9, metalness: 0 }));

  // Trim band — 0.04 proud of BOTH faces (one box dresses inner and outer).
  // End-wall bands are shortened so corner top faces never overlap/z-fight.
  const trimLen = alongX ? length - 2 * (t + 0.1) : length;
  const trimMat = texturedMaterial('trimBand', trimBandTexture, trimLen / 2.2, 1, { roughness: 0.9 });
  const trim = new THREE.Mesh(
    alongX
      ? new THREE.BoxGeometry(trimLen, 0.55, d + 0.08)
      : new THREE.BoxGeometry(w + 0.08, 0.55, trimLen),
    alongX
      ? [edge, edge, edge, edge, trimMat, trimMat]
      : [trimMat, trimMat, edge, edge, edge, edge],
  );
  trim.position.set(cx, 2.6, cz);
  trim.castShadow = true;
  trim.receiveShadow = true;
  scene.add(trim);

  // Base skirt — darker concrete strip at the wall foot, 0.02 proud.
  const skirtLen = alongX ? length - 2 * (t + 0.08) : length;
  const skirt = new THREE.Mesh(
    alongX
      ? new THREE.BoxGeometry(skirtLen, 0.5, d + 0.04)
      : new THREE.BoxGeometry(w + 0.04, 0.5, skirtLen),
    texturedMaterial('concrete', concreteTexture, skirtLen / 2, 0.25, { roughness: 0.97, tint: 0x9b9181 }),
  );
  skirt.position.set(cx, s.box.min.y + 0.25, cz);
  skirt.receiveShadow = true;
  scene.add(skirt);

  // Coping cap — light stone, 0.12 overhang on each long side. Side-wall caps
  // run past the corners; end-wall caps stop short of them (no z-fighting).
  const copLen = alongX ? length - 2 * (t + 0.24) : length + 0.24;
  const coping = new THREE.Mesh(
    alongX
      ? new THREE.BoxGeometry(copLen, 0.22, d + 0.24)
      : new THREE.BoxGeometry(w + 0.24, 0.22, copLen),
    texturedMaterial('coping', copingTexture, copLen / 2, 1, { roughness: 0.9 }),
  );
  coping.position.set(cx, s.box.max.y + 0.11, cz);
  coping.castShadow = true;
  coping.receiveShadow = true;
  scene.add(coping);
}

function addParapet(scene: THREE.Scene, s: Solid): void {
  const w = s.box.max.x - s.box.min.x;
  const h = s.box.max.y - s.box.min.y;
  const d = s.box.max.z - s.box.min.z;
  const cx = (s.box.min.x + s.box.max.x) / 2;
  const cz = (s.box.min.z + s.box.max.z) / 2;
  const alongX = w >= d;
  const length = alongX ? w : d;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    texturedMaterial('concrete', concreteTexture, Math.max(w, 1) / 2, Math.max(d, 1) / 2, {
      roughness: 0.96,
      tint: 0xc2b292,
    }),
  );
  body.position.set(cx, s.box.min.y + h / 2, cz);
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);

  const cap = new THREE.Mesh(
    alongX
      ? new THREE.BoxGeometry(length + 0.16, 0.12, d + 0.18)
      : new THREE.BoxGeometry(w + 0.18, 0.12, length + 0.16),
    texturedMaterial('coping', copingTexture, length / 2, 0.6, { roughness: 0.9 }),
  );
  cap.position.set(cx, s.box.max.y + 0.06, cz);
  cap.castShadow = true;
  cap.receiveShadow = true;
  scene.add(cap);
}

// ---------------------------------------------------------------------------
// platforms & steps
// ---------------------------------------------------------------------------

function addSlab(scene: THREE.Scene, s: Solid): void {
  const w = s.box.max.x - s.box.min.x;
  const h = s.box.max.y - s.box.min.y;
  const d = s.box.max.z - s.box.min.z;
  const cx = (s.box.min.x + s.box.max.x) / 2;
  const cz = (s.box.min.z + s.box.max.z) / 2;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    texturedMaterial('concrete', concreteTexture, w / 2, d / 2, { roughness: 0.95 }),
  );
  mesh.position.set(cx, s.box.min.y + h / 2, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  if (s.kind === 'platform') {
    // Darker nosing strip wrapping the top front edge (the edge facing mid).
    const sign = cz > 0 ? 1 : -1;
    const frontZ = cz - (sign * d) / 2;
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.05, 0.16),
      texturedMaterial('concrete', concreteTexture, w / 2, 0.1, { roughness: 0.95, tint: 0x77705f }),
    );
    nose.position.set(cx, s.box.max.y + 0.005, frontZ + sign * 0.05);
    nose.receiveShadow = true;
    scene.add(nose);
  }
}

// ---------------------------------------------------------------------------
// ground
// ---------------------------------------------------------------------------

function addGround(scene: THREE.Scene): void {
  const hx = ARENA_HALF_X;
  const hz = ARENA_HALF_Z;
  const t = WALL_THICKNESS;

  // Packed dirt over the playable arena (out to the outer wall faces).
  const innerW = (hx + t) * 2;
  const innerD = (hz + t) * 2;
  const inner = new THREE.Mesh(
    new THREE.PlaneGeometry(innerW, innerD),
    texturedMaterial('dirt', dirtTexture, innerW / 3.5, innerD / 3.5, { roughness: 1 }),
  );
  inner.rotation.x = -Math.PI / 2;
  inner.receiveShadow = true;
  scene.add(inner);

  // Wider dirt apron so the skyline props never sit over void.
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 90),
    texturedMaterial('dirt', dirtTexture, 70 / 3.5, 90 / 3.5, { roughness: 1 }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  scene.add(outer);

  // Lighter concrete strips at the wall feet. Side-wall strips lie on the
  // dirt; end-wall strips sit on the spawn platforms (the feet are at y=1).
  const sideStripMat = texturedMaterial('concrete', concreteTexture, 0.8, hz, { roughness: 0.97 });
  for (const sx of [-1, 1] as const) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.6, hz * 2), sideStripMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(sx * (hx - 0.8), 0.005, 0);
    strip.receiveShadow = true;
    scene.add(strip);
  }
  const endStripMat = texturedMaterial('concrete', concreteTexture, hx, 0.8, { roughness: 0.97 });
  for (const sz of [-1, 1] as const) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2, 1.6), endStripMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 1.006, sz * (hz - 0.8));
    strip.receiveShadow = true;
    scene.add(strip);
  }
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

export function buildWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  applySky(scene);
  applyLighting(scene, renderer);

  addGround(scene);

  for (const s of SOLIDS) {
    switch (s.kind) {
      case 'wall':
        addWall(scene, s);
        break;
      case 'parapet':
        addParapet(scene, s);
        break;
      case 'crate':
        addCrate(scene, s);
        break;
      case 'platform':
      case 'step':
        addSlab(scene, s);
        break;
    }
  }

  addDoorways(scene);
  addSkyline(scene);
}
