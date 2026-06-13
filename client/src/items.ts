import * as THREE from 'three';
import type { ItemState, WeaponType } from '@cs/shared';
import { makeContactShadow } from './gfx/props.js';

// ---------------------------------------------------------------------------
// Ground weapon pickups: a simplified lying-flat gun per visible item, with a
// soft contact-shadow blob underneath and a very slow yaw spin for readability.
// Geometries and materials are module-cached; items churn every room update.
// ---------------------------------------------------------------------------

interface ItemMats {
  akMetal: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  akMag: THREE.MeshStandardMaterial;
  m4Body: THREE.MeshStandardMaterial;
  m4Furn: THREE.MeshStandardMaterial;
  m4Mag: THREE.MeshStandardMaterial;
  awpBody: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
}

let matsCache: ItemMats | null = null;

function mats(): ItemMats {
  if (!matsCache) {
    const std = (color: number, roughness: number): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    matsCache = {
      akMetal: std(0x232325, 0.6),
      wood: std(0x6b432a, 0.85),
      akMag: std(0x7a4b22, 0.65),
      m4Body: std(0x23252a, 0.6),
      m4Furn: std(0x2e3138, 0.65),
      m4Mag: std(0x3a3d44, 0.6),
      awpBody: std(0x3d4a33, 0.7),
      dark: std(0x17181b, 0.5),
    };
  }
  return matsCache;
}

const geoCache = new Map<string, THREE.BufferGeometry>();

function boxGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const key = `b${w},${h},${d}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(key, g);
  }
  return g;
}

function cylGeo(r: number, len: number): THREE.BufferGeometry {
  const key = `c${r},${len}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(r, r, len, 10);
    geoCache.set(key, g);
  }
  return g;
}

function part(
  geo: THREE.BufferGeometry,
  mat: THREE.MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  parent: THREE.Object3D,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Simplified ground-pickup gun (6-10 meshes), built along -z around its grip. */
function buildGun(type: WeaponType): THREE.Group {
  const g = new THREE.Group();
  const m = mats();
  if (type === 'ak47') {
    part(boxGeo(0.07, 0.1, 0.42), m.akMetal, 0, 0, -0.04, g); // receiver
    part(boxGeo(0.06, 0.09, 0.24), m.wood, 0, -0.01, 0.24, g); // stock
    const grip = part(boxGeo(0.04, 0.08, 0.05), m.wood, 0, -0.08, 0.1, g);
    grip.rotation.x = -0.3;
    const mag = part(boxGeo(0.05, 0.17, 0.09), m.akMag, 0, -0.11, -0.06, g);
    mag.rotation.x = 0.45; // curved magazine
    part(boxGeo(0.065, 0.07, 0.2), m.wood, 0, 0.005, -0.33, g); // wood handguard
    const barrel = part(cylGeo(0.014, 0.26), m.akMetal, 0, 0.01, -0.55, g);
    barrel.rotation.x = Math.PI / 2;
    part(boxGeo(0.014, 0.05, 0.014), m.akMetal, 0, 0.045, -0.64, g); // front sight
  } else if (type === 'm4a4') {
    part(boxGeo(0.065, 0.095, 0.4), m.m4Body, 0, 0, -0.05, g); // receiver
    part(boxGeo(0.04, 0.025, 0.45), m.dark, 0, 0.06, -0.12, g); // top rail
    part(boxGeo(0.055, 0.08, 0.18), m.m4Furn, 0, -0.005, 0.22, g); // stock
    part(boxGeo(0.06, 0.095, 0.03), m.dark, 0, -0.005, 0.32, g); // buttpad
    const grip = part(boxGeo(0.04, 0.08, 0.05), m.m4Furn, 0, -0.075, 0.08, g);
    grip.rotation.x = -0.3;
    part(boxGeo(0.05, 0.16, 0.08), m.m4Mag, 0, -0.12, -0.08, g); // STRAIGHT mag
    part(boxGeo(0.055, 0.06, 0.26), m.m4Furn, 0, 0.005, -0.38, g); // handguard
    const barrel = part(cylGeo(0.011, 0.18), m.dark, 0, 0.01, -0.58, g);
    barrel.rotation.x = Math.PI / 2;
    part(boxGeo(0.036, 0.036, 0.06), m.dark, 0, 0.01, -0.69, g); // flash hider
  } else {
    part(boxGeo(0.06, 0.1, 0.55), m.awpBody, 0, 0, -0.18, g); // long olive body
    part(boxGeo(0.06, 0.11, 0.22), m.awpBody, 0, -0.01, 0.2, g); // thick stock
    part(boxGeo(0.05, 0.035, 0.12), m.dark, 0, 0.065, 0.2, g); // cheek riser
    part(boxGeo(0.05, 0.08, 0.1), m.dark, 0, -0.08, -0.18, g); // box mag
    const barrel = part(cylGeo(0.018, 0.5), m.dark, 0, 0.015, -0.7, g); // heavy barrel
    barrel.rotation.x = Math.PI / 2;
    const tube = part(cylGeo(0.024, 0.28), m.dark, 0, 0.085, -0.16, g); // scope tube
    tube.rotation.x = Math.PI / 2;
    const bell = part(cylGeo(0.032, 0.06), m.dark, 0, 0.085, -0.32, g); // objective bell
    bell.rotation.x = Math.PI / 2;
    part(boxGeo(0.09, 0.018, 0.018), m.dark, 0.07, 0.01, -0.02, g); // bolt handle
  }
  return g;
}

// ---------------------------------------------------------------------------
// GroundItems
// ---------------------------------------------------------------------------

const SPIN_RATE = 0.4; // rad/s, subtle idle yaw so pickups read in motion
const LIFT = 0.06; // raise above the surface to avoid z-fighting

interface Entry {
  root: THREE.Group;
  shadow: THREE.Mesh;
  type: WeaponType;
}

export class GroundItems {
  private entries = new Map<number, Entry>();

  constructor(private scene: THREE.Scene) {}

  /** Create/remove/update item meshes by id. Idempotent per room update. */
  sync(items: ItemState[]): void {
    const seen = new Set<number>();
    for (const it of items) {
      if (it.taken) continue;
      seen.add(it.id);
      let e = this.entries.get(it.id);
      if (e && e.type !== it.type) {
        this.remove(it.id, e); // id reused for a different gun: rebuild
        e = undefined;
      }
      if (!e) {
        e = this.create(it);
        this.entries.set(it.id, e);
        this.scene.add(e.root);
      }
      e.root.position.set(it.x, it.y, it.z);
    }
    for (const [id, e] of this.entries) {
      if (!seen.has(id)) this.remove(id, e);
    }
  }

  update(dt: number): void {
    for (const e of this.entries.values()) {
      e.root.rotation.y += dt * SPIN_RATE;
    }
  }

  private create(it: ItemState): Entry {
    const root = new THREE.Group();
    // stable per-id resting yaw (golden-angle hash) so drops don't all align
    root.rotation.y = (it.id * 2.39996) % (Math.PI * 2);

    const gun = buildGun(it.type);
    gun.rotation.z = Math.PI / 2; // lying flat on its side
    gun.position.y = LIFT;
    root.add(gun);

    // soft dark blob under the gun (radial-gradient canvas plane)
    const shadow = makeContactShadow(0.22, it.type === 'awp' ? 0.76 : 0.62, 0.35);
    shadow.position.y = 0.01;
    root.add(shadow);

    return { root, shadow, type: it.type };
  }

  private remove(id: number, e: Entry): void {
    this.scene.remove(e.root);
    // gun geometries/materials and the shadow material are module-cached;
    // only the per-item shadow plane geometry is unique.
    e.shadow.geometry.dispose();
    this.entries.delete(id);
  }
}
