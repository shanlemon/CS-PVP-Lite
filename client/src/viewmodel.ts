import * as THREE from 'three';
import { DEFAULT_WEAPON, WEAPONS } from '@cs/shared';
import type { Vec3, WeaponType } from '@cs/shared';

/** 0→1 smoothstep ramp of t across [a, b]. */
function ramp(t: number, a: number, b: number): number {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

// ---------------------------------------------------------------------------
// Procedural textures
// ---------------------------------------------------------------------------

/** Wood grain for handguard / stock / grip: base, tone bands, grain, speckle. */
function makeWoodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6b432a';
  g.fillRect(0, 0, 64, 64);
  // broad tone bands
  for (let i = 0; i < 10; i++) {
    g.globalAlpha = 0.14;
    g.fillStyle = Math.random() < 0.5 ? '#7d5233' : '#5a3722';
    g.fillRect(0, Math.random() * 64, 64, 3 + Math.random() * 6);
  }
  g.globalAlpha = 1;
  // grain streaks
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(40,22,10,${0.12 + Math.random() * 0.18})`;
    g.lineWidth = 0.6 + Math.random();
    const y = Math.random() * 64;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(
      20,
      y + (Math.random() * 4 - 2),
      44,
      y + (Math.random() * 4 - 2),
      64,
      y + (Math.random() * 3 - 1.5),
    );
    g.stroke();
  }
  // fine speckle
  for (let i = 0; i < 90; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,220,170,0.05)';
    g.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** M4 handguard: cool grey-black polymer with painted accessory-rail dots. */
function makeRailDotTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2e3138';
  g.fillRect(0, 0, 64, 64);
  // soft tonal bands so the polymer doesn't read perfectly flat
  for (let i = 0; i < 8; i++) {
    g.globalAlpha = 0.08;
    g.fillStyle = Math.random() < 0.5 ? '#000000' : '#aab0bd';
    g.fillRect(0, Math.random() * 64, 64, 4 + Math.random() * 8);
  }
  g.globalAlpha = 1;
  // three rows of rail dots: light rim + dark recess
  for (const y of [10, 32, 54]) {
    for (let x = 6; x < 64; x += 10) {
      g.fillStyle = 'rgba(150,156,168,0.85)';
      g.beginPath();
      g.arc(x, y, 1.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.arc(x + 0.6, y + 0.6, 1, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 4-armed star muzzle flash: bright white-yellow core, tapering orange arms. */
function makeFlashTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d')!;
  g.translate(48, 48);
  for (let i = 0; i < 4; i++) {
    g.save();
    g.rotate((Math.PI / 2) * i);
    const grad = g.createLinearGradient(0, 0, 44, 0);
    grad.addColorStop(0, 'rgba(255,210,110,0.95)');
    grad.addColorStop(0.55, 'rgba(255,150,40,0.55)');
    grad.addColorStop(1, 'rgba(255,110,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(2, -5);
    g.lineTo(44, -1);
    g.lineTo(44, 1);
    g.lineTo(2, 5);
    g.closePath();
    g.fill();
    g.restore();
  }
  const core = g.createRadialGradient(0, 0, 1, 0, 0, 16);
  core.addColorStop(0, 'rgba(255,255,235,1)');
  core.addColorStop(0.5, 'rgba(255,230,140,0.9)');
  core.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = core;
  g.fillRect(-20, -20, 40, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Grey-tan dust burst for bullet impacts: soft base, clumps, speckle. */
function makeImpactTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(24, 24, 2, 24, 24, 22);
  grad.addColorStop(0, 'rgba(176,160,132,0.9)');
  grad.addColorStop(0.55, 'rgba(150,134,106,0.45)');
  grad.addColorStop(1, 'rgba(110,96,72,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 48, 48);
  // clumpy blotches around the center
  for (let i = 0; i < 9; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 12;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(120,104,80,0.3)' : 'rgba(196,180,150,0.28)';
    g.beginPath();
    g.arc(24 + Math.cos(ang) * r, 24 + Math.sin(ang) * r, 1.5 + Math.random() * 3.5, 0, Math.PI * 2);
    g.fill();
  }
  // speckle
  for (let i = 0; i < 30; i++) {
    g.fillStyle = 'rgba(90,78,58,0.35)';
    g.fillRect(Math.random() * 48, Math.random() * 48, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// First-person gun builders. Each gun is a self-contained group with its own
// muzzle tip marker; the Viewmodel toggles visibility between them.
// ---------------------------------------------------------------------------

interface GunRig {
  group: THREE.Group;
  tip: THREE.Object3D;
  /** Magazine pivot (positioned at the magwell) — animated during reloads. */
  mag: THREE.Object3D | null;
  magHome: { y: number; z: number; rotX: number };
  /** AWP bolt pivot — cycled during reloads. */
  bolt: THREE.Object3D | null;
  boltHome: { z: number; rotZ: number };
}

function rigOf(group: THREE.Group, tip: THREE.Object3D, mag: THREE.Object3D | null, bolt: THREE.Object3D | null): GunRig {
  return {
    group,
    tip,
    mag,
    magHome: mag ? { y: mag.position.y, z: mag.position.z, rotX: mag.rotation.x } : { y: 0, z: 0, rotX: 0 },
    bolt,
    boltHome: bolt ? { z: bolt.position.z, rotZ: bolt.rotation.z } : { z: 0, rotZ: 0 },
  };
}

function addBox(
  w: number,
  h: number,
  d: number,
  mat: THREE.MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  parent: THREE.Object3D,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Cylinder laid along the barrel axis (local -z). */
function addCyl(
  r: number,
  len: number,
  mat: THREE.MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  parent: THREE.Object3D,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** AK-47: stamped receiver, wood furniture, curved bakelite mag. */
function buildAk47(): GunRig {
  const group = new THREE.Group();
  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.55, metalness: 0 });
  const cover = new THREE.MeshStandardMaterial({ color: 0x2d2d31, roughness: 0.5, metalness: 0 });
  const wood = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.8, metalness: 0 });
  const bakelite = new THREE.MeshStandardMaterial({ color: 0x7a4b22, roughness: 0.6, metalness: 0 });

  // stamped receiver + slightly lighter dust cover line
  addBox(0.052, 0.075, 0.3, gunmetal, 0, 0, -0.02, group);
  addBox(0.054, 0.018, 0.24, cover, 0, 0.047, -0.04, group);

  // rear sight: base + notch leaf
  addBox(0.024, 0.014, 0.03, gunmetal, 0, 0.06, -0.14, group);
  addBox(0.018, 0.016, 0.012, cover, 0, 0.072, -0.135, group);

  // wooden pistol grip (raked back) and stock (dropping toward the butt)
  const grip = addBox(0.038, 0.1, 0.05, wood, 0, -0.078, 0.085, group);
  grip.rotation.x = -0.35;
  const stock = addBox(0.045, 0.075, 0.24, wood, 0, -0.025, 0.25, group);
  stock.rotation.x = 0.1;

  // curved 30-round magazine: 3 segments, each rotated ~12 deg further
  const magGroup = new THREE.Group();
  magGroup.position.set(0, -0.045, -0.07);
  let ang = 0.28;
  let py = 0;
  let pz = 0;
  const segGeo = new THREE.BoxGeometry(0.042, 0.09, 0.068);
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(segGeo, bakelite);
    seg.position.set(0, py - 0.04, pz);
    seg.rotation.x = ang;
    magGroup.add(seg);
    py -= Math.cos(ang) * 0.082;
    pz -= Math.sin(ang) * 0.082;
    ang += 0.21;
  }
  group.add(magGroup);

  // wooden handguard, two stacked pieces with a gap
  addBox(0.052, 0.05, 0.17, wood, 0, -0.002, -0.26, group);
  addBox(0.046, 0.028, 0.15, wood, 0, 0.054, -0.25, group);

  // gas tube above the barrel
  const gas = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.12, 10), gunmetal);
  gas.rotation.x = Math.PI / 2;
  gas.position.set(0, 0.052, -0.37);
  group.add(gas);

  // barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.24, 10), gunmetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.008, -0.45);
  group.add(barrel);

  // front sight post (base + post)
  addBox(0.02, 0.032, 0.022, gunmetal, 0, 0.042, -0.53, group);
  addBox(0.006, 0.03, 0.006, gunmetal, 0, 0.07, -0.53, group);

  // slanted muzzle brake; the muzzle tip sits at its mouth
  const brake = addBox(0.028, 0.028, 0.055, gunmetal, 0, 0.008, -0.595, group);
  brake.rotation.x = 0.5;

  const tip = new THREE.Object3D();
  tip.position.set(0, 0.008, -0.628);
  group.add(tip);
  return rigOf(group, tip, magGroup, null);
}

/** M4A4: flat grey-black carbine — rail, sight towers, straight mag, flash hider. */
function buildM4a4(): GunRig {
  const group = new THREE.Group();
  const receiver = new THREE.MeshStandardMaterial({ color: 0x23252a, roughness: 0.5, metalness: 0 });
  const furniture = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.55, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.45, metalness: 0 });
  const magMat = new THREE.MeshStandardMaterial({ color: 0x34373e, roughness: 0.5, metalness: 0 });
  const guard = new THREE.MeshStandardMaterial({ map: makeRailDotTexture(), roughness: 0.55, metalness: 0 });

  // flat receiver with a magwell bulge and right-side ejection port plate
  addBox(0.05, 0.07, 0.28, receiver, 0, 0, -0.01, group);
  addBox(0.054, 0.05, 0.09, receiver, 0, -0.012, -0.06, group);
  addBox(0.004, 0.024, 0.06, steel, 0.028, 0.004, -0.03, group);

  // low top rail spanning receiver + handguard
  addBox(0.034, 0.014, 0.44, steel, 0, 0.042, -0.1, group);

  // rear iron sight tower: base + aperture leaf
  addBox(0.024, 0.018, 0.022, steel, 0, 0.058, 0.07, group);
  addBox(0.016, 0.014, 0.008, steel, 0, 0.073, 0.07, group);

  // straight 30-round dark grey magazine + baseplate (on a magwell pivot)
  const magGroup = new THREE.Group();
  magGroup.position.set(0, -0.045, -0.06);
  addBox(0.04, 0.13, 0.062, magMat, 0, -0.055, 0, magGroup);
  addBox(0.044, 0.016, 0.068, steel, 0, -0.127, 0, magGroup);
  group.add(magGroup);

  // raked pistol grip
  const grip = addBox(0.036, 0.095, 0.048, furniture, 0, -0.075, 0.08, group);
  grip.rotation.x = -0.32;

  // buffer tube + adjustable stock body + lower hook + rubber buttpad
  addCyl(0.013, 0.1, receiver, 0, 0.012, 0.16, group);
  addBox(0.04, 0.058, 0.1, furniture, 0, -0.002, 0.245, group);
  addBox(0.034, 0.03, 0.07, furniture, 0, -0.042, 0.26, group);
  addBox(0.046, 0.078, 0.018, steel, 0, -0.006, 0.302, group);

  // long slim octagonal-ish handguard: dotted box + 45-degree rotated core
  addBox(0.046, 0.046, 0.26, guard, 0, 0.002, -0.33, group);
  const oct = addBox(0.04, 0.04, 0.26, furniture, 0, 0.002, -0.33, group);
  oct.rotation.z = Math.PI / 4;

  // front sight tower: base + post
  addBox(0.018, 0.028, 0.018, steel, 0, 0.058, -0.44, group);
  addBox(0.005, 0.02, 0.005, steel, 0, 0.08, -0.44, group);

  // barrel + birdcage flash hider; muzzle tip at its mouth
  addCyl(0.009, 0.16, steel, 0, 0.004, -0.54, group);
  addCyl(0.0145, 0.055, steel, 0, 0.004, -0.642, group);

  const tip = new THREE.Object3D();
  tip.position.set(0, 0.004, -0.672);
  group.add(tip);
  return rigOf(group, tip, magGroup, null);
}

/** AWP: long olive body, thick cheek-riser stock, heavy barrel, big scope, bolt. */
function buildAwp(): GunRig {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x3d4a33, roughness: 0.65, metalness: 0 });
  const bodyDark = new THREE.MeshStandardMaterial({ color: 0x333e2b, roughness: 0.7, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.45, metalness: 0 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.2, metalness: 0 });

  // long main body / receiver
  addBox(0.05, 0.075, 0.36, body, 0, 0, -0.06, group);

  // thick stock: body + grip web + cheek riser + dark buttpad
  addBox(0.048, 0.095, 0.2, body, 0, -0.025, 0.2, group);
  addBox(0.04, 0.05, 0.1, body, 0, -0.062, 0.13, group);
  addBox(0.04, 0.028, 0.115, bodyDark, 0, 0.038, 0.215, group);
  addBox(0.054, 0.105, 0.022, steel, 0, -0.025, 0.31, group);

  // raked pistol grip + stubby 5-round box magazine (on a magwell pivot)
  const grip = addBox(0.034, 0.085, 0.046, bodyDark, 0, -0.085, 0.06, group);
  grip.rotation.x = -0.3;
  const magGroup = new THREE.Group();
  magGroup.position.set(0, -0.03, -0.07);
  addBox(0.038, 0.06, 0.085, steel, 0, -0.03, 0, magGroup);
  group.add(magGroup);

  // long heavy free-floating barrel + muzzle collar
  addCyl(0.0145, 0.5, steel, 0, 0.012, -0.49, group);
  addCyl(0.018, 0.045, steel, 0, 0.012, -0.76, group);

  // bolt handle sticking out the right side, angled down, with a ball knob
  const boltGroup = new THREE.Group();
  boltGroup.position.set(0.024, 0.012, 0.05);
  boltGroup.rotation.z = -0.55;
  const boltRod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8), steel);
  boltRod.rotation.z = Math.PI / 2;
  boltRod.position.x = 0.03;
  const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), steel);
  boltKnob.position.x = 0.066;
  boltGroup.add(boltRod, boltKnob);
  group.add(boltGroup);

  // BIG scope: two mounts, main tube, objective bell, ocular, rear lens disc
  addBox(0.022, 0.034, 0.03, steel, 0, 0.055, -0.13, group);
  addBox(0.022, 0.034, 0.03, steel, 0, 0.055, 0.02, group);
  addCyl(0.019, 0.2, steel, 0, 0.088, -0.055, group);
  addCyl(0.027, 0.075, steel, 0, 0.088, -0.185, group);
  addCyl(0.025, 0.06, steel, 0, 0.088, 0.075, group);
  addCyl(0.0205, 0.006, lens, 0, 0.088, 0.104, group); // dark glass at the back
  // elevation turret on top of the tube
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 10), steel);
  turret.position.set(0, 0.115, -0.055);
  group.add(turret);

  const tip = new THREE.Object3D();
  tip.position.set(0, 0.012, -0.79);
  group.add(tip);
  return rigOf(group, tip, magGroup, boltGroup);
}

// ---------------------------------------------------------------------------
// Viewmodel: first-person weapon attached to the camera
// ---------------------------------------------------------------------------

const BASE_X = 0.26;
const BASE_Y = -0.24;
const BASE_Z = -0.55;

export class Viewmodel {
  group = new THREE.Group();
  private muzzleFlash: THREE.Sprite;
  private guns: Record<WeaponType, GunRig>;
  private current!: WeaponType;
  private kickStrength = 0.45;
  private kickCap = 1;
  private recoverRate = 6;
  private recoil = 0;
  private bobT = 0;
  private swayT = 0;
  private flashUntil = 0;
  private reloadT = -1; // seconds into the reload animation; -1 = not reloading

  constructor(camera: THREE.Camera) {
    this.guns = { ak47: buildAk47(), m4a4: buildM4a4(), awp: buildAwp() };
    for (const rig of Object.values(this.guns)) {
      rig.group.visible = false;
      this.group.add(rig.group);
    }

    this.muzzleFlash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeFlashTexture(),
        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true,
      }),
    );
    this.muzzleFlash.scale.set(0.3, 0.3, 1);
    this.muzzleFlash.visible = false;
    this.group.add(this.muzzleFlash);

    this.setWeapon(DEFAULT_WEAPON);

    this.group.position.set(BASE_X, BASE_Y, BASE_Z);
    // Slightly under-scaled so the gun doesn't dominate the frame (CS2-style).
    this.group.scale.setScalar(0.85);
    camera.add(this.group);
  }

  /** Swap the displayed gun. Idempotent and cheap (all guns are prebuilt). */
  setWeapon(type: WeaponType): void {
    if (this.current === type) return;
    this.current = type;
    this.reloadT = -1;
    for (const id of Object.keys(this.guns) as WeaponType[]) {
      this.guns[id].group.visible = id === type;
      this.resetRigPose(this.guns[id]);
    }
    // the flash follows the active gun's muzzle (gun groups sit at the origin)
    this.muzzleFlash.position.copy(this.guns[type].tip.position);
    if (type === 'awp') {
      this.kickStrength = 1.1; // ~2.5x the rifles
      this.kickCap = 1.3;
      this.recoverRate = 4.5; // slightly longer recover
    } else {
      this.kickStrength = 0.45;
      this.kickCap = 1;
      this.recoverRate = 6;
    }
  }

  /** Returns the active weapon's muzzle position in world space. */
  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.guns[this.current].tip.getWorldPosition(out);
  }

  kick(): void {
    this.recoil = Math.min(this.kickCap, this.recoil + this.kickStrength);
    this.flashUntil = performance.now() + 45;
    this.muzzleFlash.material.rotation = Math.random() * Math.PI;
  }

  private resetRigPose(rig: GunRig): void {
    if (rig.mag) {
      rig.mag.position.y = rig.magHome.y;
      rig.mag.position.z = rig.magHome.z;
      rig.mag.rotation.x = rig.magHome.rotX;
      rig.mag.visible = true;
    }
    if (rig.bolt) {
      rig.bolt.position.z = rig.boltHome.z;
      rig.bolt.rotation.z = rig.boltHome.rotZ;
    }
  }

  /**
   * Reload animation: gun dips and rolls inward, the mag drops out and a fresh
   * one slides back in, the AWP also cycles its bolt, and the gun snaps back
   * up with a small tug at the end. Timed to the weapon's real reload length.
   */
  private reloadPose(rig: GunRig, reloading: boolean, dt: number): { y: number; rotX: number; rotZ: number } {
    if (reloading) {
      if (this.reloadT < 0) this.reloadT = 0;
      this.reloadT += dt;
    } else if (this.reloadT >= 0) {
      this.reloadT = -1;
      this.resetRigPose(rig);
    }
    if (this.reloadT < 0) return { y: 0, rotX: 0, rotZ: 0 };

    const t = Math.min(1, this.reloadT / WEAPONS[this.current].reloadTime);

    // gun dip + inward roll, held for the whole reload
    const dip = ramp(t, 0, 0.12) * (1 - ramp(t, 0.86, 1));
    // end-of-reload tug (bolt rack / charging handle slap)
    const tug = ramp(t, 0.84, 0.88) * (1 - ramp(t, 0.88, 0.96));

    if (rig.mag) {
      const out = ramp(t, 0.12, 0.34); // old mag drops out
      const inn = ramp(t, 0.5, 0.72); // fresh mag slides in
      const k = out * (1 - inn);
      rig.mag.position.y = rig.magHome.y - 0.26 * k;
      rig.mag.position.z = rig.magHome.z + 0.08 * k;
      rig.mag.rotation.x = rig.magHome.rotX + 0.55 * k;
      rig.mag.visible = !(t > 0.38 && t < 0.5); // briefly gone between mags
    }
    if (rig.bolt) {
      // AWP: bolt up + back early, forward + down late
      const up = ramp(t, 0.02, 0.1) * (1 - ramp(t, 0.88, 0.97));
      const back = ramp(t, 0.1, 0.18) * (1 - ramp(t, 0.76, 0.86));
      rig.bolt.rotation.z = rig.boltHome.rotZ + 0.85 * up;
      rig.bolt.position.z = rig.boltHome.z + 0.07 * back;
    }

    return {
      y: -0.06 * dip,
      rotX: -0.32 * dip - 0.1 * tug,
      rotZ: 0.2 * dip,
    };
  }

  update(dt: number, moveSpeed: number, reloading = false): void {
    this.recoil = Math.max(0, this.recoil - dt * this.recoverRate);
    // Walk-cycle bob: ~1.6 Hz at full sprint (CS-like), with a slight lateral
    // sway at half rate so it traces a shallow figure-eight.
    this.bobT += dt * (1 + moveSpeed * 0.55);
    this.swayT += dt;
    const bobAmount = Math.min(1, moveSpeed / 5);
    const bob = Math.sin(this.bobT * 2.2) * 0.005 * bobAmount;
    const bobX = Math.sin(this.bobT * 1.1) * 0.003 * bobAmount;
    // subtle idle sway on top of the movement bob
    const swayX = Math.sin(this.swayT * 0.8) * 0.0035;
    const swayY = Math.sin(this.swayT * 1.1 + 1.7) * 0.0025;

    const rl = this.reloadPose(this.guns[this.current], reloading, dt);

    this.group.position.set(BASE_X + swayX + bobX, BASE_Y + bob + swayY + rl.y, BASE_Z + this.recoil * 0.06);
    this.group.rotation.x = this.recoil * 0.12 + rl.rotX;
    this.group.rotation.z = Math.sin(this.swayT * 0.6) * 0.004 + rl.rotZ;
    this.muzzleFlash.visible = performance.now() < this.flashUntil;
  }
}

// ---------------------------------------------------------------------------
// Effects: tracers, impact dust, sparks
// ---------------------------------------------------------------------------

const TRACER_LIFE = 0.07;
const IMPACT_LIFE = 0.15;
const SPARK_LIFE = 0.06;

interface Tracer {
  core: THREE.Line;
  glow: THREE.Line;
  life: number;
}

interface Impact {
  sprite: THREE.Sprite;
  life: number;
}

interface Spark {
  line: THREE.Line;
  life: number;
}

export class Effects {
  private tracers: Tracer[] = [];
  private impacts: Impact[] = [];
  private sparks: Spark[] = [];
  private impactTex = makeImpactTexture();

  constructor(private scene: THREE.Scene) {}

  shot(from: Vec3, to: Vec3): void {
    const a = new THREE.Vector3(from.x, from.y, from.z);
    const b = new THREE.Vector3(to.x, to.y, to.z);

    // tracer: thin bright core + offset additive glow pass
    const core = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a, b]),
      new THREE.LineBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.95 }),
    );
    const off = new THREE.Vector3(0.012, 0.014, 0.012);
    const glow = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a.clone().add(off), b.clone().add(off)]),
      new THREE.LineBasicMaterial({
        color: 0xffb24d,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.scene.add(core, glow);
    this.tracers.push({ core, glow, life: TRACER_LIFE });

    // dust burst at the impact point
    const mat = new THREE.SpriteMaterial({ map: this.impactTex, transparent: true, depthWrite: false });
    mat.rotation = Math.random() * Math.PI * 2;
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(b);
    sprite.scale.set(0.3, 0.3, 1);
    this.scene.add(sprite);
    this.impacts.push({ sprite, life: IMPACT_LIFE });

    // 2-3 tiny sparks radiating from the hit point
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(0.07 + Math.random() * 0.1);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([b.clone(), b.clone().add(dir)]),
        new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 }),
      );
      this.scene.add(line);
      this.sparks.push({ line, life: SPARK_LIFE });
    }
  }

  update(dt: number): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      const k = Math.max(0, t.life / TRACER_LIFE);
      (t.core.material as THREE.LineBasicMaterial).opacity = k * 0.95;
      (t.glow.material as THREE.LineBasicMaterial).opacity = k * 0.35;
      if (t.life <= 0) {
        this.scene.remove(t.core, t.glow);
        t.core.geometry.dispose();
        (t.core.material as THREE.Material).dispose();
        t.glow.geometry.dispose();
        (t.glow.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const im = this.impacts[i];
      im.life -= dt;
      im.sprite.material.opacity = Math.max(0, im.life / IMPACT_LIFE);
      if (im.life <= 0) {
        this.scene.remove(im.sprite);
        im.sprite.material.dispose();
        this.impacts.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      (s.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, s.life / SPARK_LIFE) * 0.9;
      if (s.life <= 0) {
        this.scene.remove(s.line);
        s.line.geometry.dispose();
        (s.line.material as THREE.Material).dispose();
        this.sparks.splice(i, 1);
      }
    }
  }
}
