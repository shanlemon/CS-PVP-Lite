import * as THREE from 'three';
import type { WeaponType } from '@cs/shared';

function makeWoodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6b432a';
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 10; i++) {
    g.globalAlpha = 0.14;
    g.fillStyle = Math.random() < 0.5 ? '#7d5233' : '#5a3722';
    g.fillRect(0, Math.random() * 64, 64, 3 + Math.random() * 6);
  }
  g.globalAlpha = 1;
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
  for (let i = 0; i < 90; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,220,170,0.05)';
    g.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRailDotTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2e3138';
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 8; i++) {
    g.globalAlpha = 0.08;
    g.fillStyle = Math.random() < 0.5 ? '#000000' : '#aab0bd';
    g.fillRect(0, Math.random() * 64, 64, 4 + Math.random() * 8);
  }
  g.globalAlpha = 1;
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

export function makeFlashTexture(): THREE.CanvasTexture {
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

export interface GunRig {
  group: THREE.Group;
  tip: THREE.Object3D;
  mag: THREE.Object3D | null;
  magHome: { y: number; z: number; rotX: number };
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

function buildAk47(): GunRig {
  const group = new THREE.Group();
  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.55, metalness: 0 });
  const cover = new THREE.MeshStandardMaterial({ color: 0x2d2d31, roughness: 0.5, metalness: 0 });
  const wood = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.8, metalness: 0 });
  const bakelite = new THREE.MeshStandardMaterial({ color: 0x7a4b22, roughness: 0.6, metalness: 0 });

  addBox(0.052, 0.075, 0.3, gunmetal, 0, 0, -0.02, group);
  addBox(0.054, 0.018, 0.24, cover, 0, 0.047, -0.04, group);
  addBox(0.024, 0.014, 0.03, gunmetal, 0, 0.06, -0.14, group);
  addBox(0.018, 0.016, 0.012, cover, 0, 0.072, -0.135, group);

  const grip = addBox(0.038, 0.1, 0.05, wood, 0, -0.078, 0.085, group);
  grip.rotation.x = -0.35;
  const stock = addBox(0.045, 0.075, 0.24, wood, 0, -0.025, 0.25, group);
  stock.rotation.x = 0.1;

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

  addBox(0.052, 0.05, 0.17, wood, 0, -0.002, -0.26, group);
  addBox(0.046, 0.028, 0.15, wood, 0, 0.054, -0.25, group);

  const gas = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.12, 10), gunmetal);
  gas.rotation.x = Math.PI / 2;
  gas.position.set(0, 0.052, -0.37);
  group.add(gas);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.24, 10), gunmetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.008, -0.45);
  group.add(barrel);

  addBox(0.02, 0.032, 0.022, gunmetal, 0, 0.042, -0.53, group);
  addBox(0.006, 0.03, 0.006, gunmetal, 0, 0.07, -0.53, group);
  const brake = addBox(0.028, 0.028, 0.055, gunmetal, 0, 0.008, -0.595, group);
  brake.rotation.x = 0.5;

  const tip = new THREE.Object3D();
  tip.position.set(0, 0.008, -0.628);
  group.add(tip);
  return rigOf(group, tip, magGroup, null);
}

function buildM4a4(): GunRig {
  const group = new THREE.Group();
  const receiver = new THREE.MeshStandardMaterial({ color: 0x23252a, roughness: 0.5, metalness: 0 });
  const furniture = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.55, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.45, metalness: 0 });
  const magMat = new THREE.MeshStandardMaterial({ color: 0x34373e, roughness: 0.5, metalness: 0 });
  const guard = new THREE.MeshStandardMaterial({ map: makeRailDotTexture(), roughness: 0.55, metalness: 0 });

  addBox(0.05, 0.07, 0.28, receiver, 0, 0, -0.01, group);
  addBox(0.054, 0.05, 0.09, receiver, 0, -0.012, -0.06, group);
  addBox(0.004, 0.024, 0.06, steel, 0.028, 0.004, -0.03, group);
  addBox(0.034, 0.014, 0.44, steel, 0, 0.042, -0.1, group);
  addBox(0.024, 0.018, 0.022, steel, 0, 0.058, 0.07, group);
  addBox(0.016, 0.014, 0.008, steel, 0, 0.073, 0.07, group);

  const magGroup = new THREE.Group();
  magGroup.position.set(0, -0.045, -0.06);
  addBox(0.04, 0.13, 0.062, magMat, 0, -0.055, 0, magGroup);
  addBox(0.044, 0.016, 0.068, steel, 0, -0.127, 0, magGroup);
  group.add(magGroup);

  const grip = addBox(0.036, 0.095, 0.048, furniture, 0, -0.075, 0.08, group);
  grip.rotation.x = -0.32;

  addCyl(0.013, 0.1, receiver, 0, 0.012, 0.16, group);
  addBox(0.04, 0.058, 0.1, furniture, 0, -0.002, 0.245, group);
  addBox(0.034, 0.03, 0.07, furniture, 0, -0.042, 0.26, group);
  addBox(0.046, 0.078, 0.018, steel, 0, -0.006, 0.302, group);
  addBox(0.046, 0.046, 0.26, guard, 0, 0.002, -0.33, group);
  const oct = addBox(0.04, 0.04, 0.26, furniture, 0, 0.002, -0.33, group);
  oct.rotation.z = Math.PI / 4;

  addBox(0.018, 0.028, 0.018, steel, 0, 0.058, -0.44, group);
  addBox(0.005, 0.02, 0.005, steel, 0, 0.08, -0.44, group);
  addCyl(0.009, 0.16, steel, 0, 0.004, -0.54, group);
  addCyl(0.0145, 0.055, steel, 0, 0.004, -0.642, group);

  const tip = new THREE.Object3D();
  tip.position.set(0, 0.004, -0.672);
  group.add(tip);
  return rigOf(group, tip, magGroup, null);
}

function buildAwp(): GunRig {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x3d4a33, roughness: 0.65, metalness: 0 });
  const bodyDark = new THREE.MeshStandardMaterial({ color: 0x333e2b, roughness: 0.7, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.45, metalness: 0 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.2, metalness: 0 });

  addBox(0.05, 0.075, 0.36, body, 0, 0, -0.06, group);
  addBox(0.048, 0.095, 0.2, body, 0, -0.025, 0.2, group);
  addBox(0.04, 0.05, 0.1, body, 0, -0.062, 0.13, group);
  addBox(0.04, 0.028, 0.115, bodyDark, 0, 0.038, 0.215, group);
  addBox(0.054, 0.105, 0.022, steel, 0, -0.025, 0.31, group);

  const grip = addBox(0.034, 0.085, 0.046, bodyDark, 0, -0.085, 0.06, group);
  grip.rotation.x = -0.3;
  const magGroup = new THREE.Group();
  magGroup.position.set(0, -0.03, -0.07);
  addBox(0.038, 0.06, 0.085, steel, 0, -0.03, 0, magGroup);
  group.add(magGroup);

  addCyl(0.0145, 0.5, steel, 0, 0.012, -0.49, group);
  addCyl(0.018, 0.045, steel, 0, 0.012, -0.76, group);

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

  addBox(0.022, 0.034, 0.03, steel, 0, 0.055, -0.13, group);
  addBox(0.022, 0.034, 0.03, steel, 0, 0.055, 0.02, group);
  addCyl(0.019, 0.2, steel, 0, 0.088, -0.055, group);
  addCyl(0.027, 0.075, steel, 0, 0.088, -0.185, group);
  addCyl(0.025, 0.06, steel, 0, 0.088, 0.075, group);
  addCyl(0.0205, 0.006, lens, 0, 0.088, 0.104, group);
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 10), steel);
  turret.position.set(0, 0.115, -0.055);
  group.add(turret);

  const tip = new THREE.Object3D();
  tip.position.set(0, 0.012, -0.79);
  group.add(tip);
  return rigOf(group, tip, magGroup, boltGroup);
}

export function buildViewmodelGuns(): Record<WeaponType, GunRig> {
  return { ak47: buildAk47(), m4a4: buildM4a4(), awp: buildAwp() };
}
