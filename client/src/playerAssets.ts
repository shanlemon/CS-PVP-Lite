import * as THREE from 'three';
import type { Team } from '@cs/shared';

function clothTexture(base: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 64);

  for (let i = 0; i < 14; i++) {
    g.globalAlpha = 0.1 + Math.random() * 0.06;
    g.fillStyle = Math.random() < 0.5 ? '#000000' : '#ffffff';
    g.beginPath();
    g.ellipse(
      Math.random() * 64,
      Math.random() * 64,
      6 + Math.random() * 12,
      4 + Math.random() * 9,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    g.fill();
  }
  g.globalAlpha = 1;

  for (let i = 0; i < 170; i++) {
    g.fillStyle = Math.random() < 0.55 ? 'rgba(0,0,0,0.11)' : 'rgba(255,255,255,0.05)';
    g.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
  }

  g.fillStyle = 'rgba(0,0,0,0.04)';
  for (let x = 0; x < 64; x += 4) {
    g.fillRect(x, 0, 1, 64);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function vestTextureT(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#42321f';
  g.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 22; i++) {
    g.globalAlpha = 0.12;
    g.fillStyle = Math.random() < 0.5 ? '#2f2315' : '#55422a';
    g.beginPath();
    g.ellipse(
      Math.random() * 128,
      Math.random() * 128,
      8 + Math.random() * 18,
      6 + Math.random() * 12,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    g.fill();
  }
  g.globalAlpha = 1;

  for (let i = 0; i < 300; i++) {
    g.fillStyle = Math.random() < 0.55 ? 'rgba(0,0,0,0.12)' : 'rgba(255,235,200,0.05)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }

  g.fillStyle = '#332718';
  g.fillRect(20, 0, 12, 44);
  g.fillRect(96, 0, 12, 44);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(20, 0, 2, 44);
  g.fillRect(106, 0, 2, 44);

  for (let p = 0; p < 3; p++) {
    const x = 14 + p * 36;
    g.fillStyle = '#4f3c25';
    g.fillRect(x, 64, 28, 36);
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 2;
    g.strokeRect(x + 1, 65, 26, 34);
    g.fillStyle = '#3a2c1b';
    g.fillRect(x, 60, 28, 12);
    g.fillStyle = 'rgba(255,235,200,0.1)';
    g.fillRect(x, 60, 28, 2);
    g.fillStyle = '#241b10';
    g.fillRect(x + 12, 68, 4, 6);
  }

  g.fillStyle = 'rgba(255,225,180,0.08)';
  g.fillRect(0, 124, 128, 4);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function vestTextureCT(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5b6878';
  g.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 20; i++) {
    g.globalAlpha = 0.11;
    g.fillStyle = Math.random() < 0.5 ? '#46525f' : '#6e7c8e';
    g.beginPath();
    g.ellipse(
      Math.random() * 128,
      Math.random() * 128,
      8 + Math.random() * 16,
      6 + Math.random() * 11,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    g.fill();
  }
  g.globalAlpha = 1;

  for (let i = 0; i < 280; i++) {
    g.fillStyle = Math.random() < 0.55 ? 'rgba(0,0,0,0.1)' : 'rgba(225,238,255,0.05)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }

  g.fillStyle = '#65748a';
  g.beginPath();
  g.roundRect(26, 24, 76, 78, 8);
  g.fill();
  g.strokeStyle = 'rgba(10,16,26,0.55)';
  g.lineWidth = 3;
  g.stroke();

  g.strokeStyle = 'rgba(10,16,26,0.3)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(30, 52);
  g.lineTo(98, 52);
  g.moveTo(30, 78);
  g.lineTo(98, 78);
  g.stroke();

  g.fillStyle = '#4d5a6b';
  g.fillRect(48, 30, 32, 14);
  g.strokeStyle = 'rgba(10,16,26,0.4)';
  g.lineWidth = 1.5;
  g.strokeRect(48, 30, 32, 14);

  g.fillStyle = '#3e4856';
  g.fillRect(0, 56, 14, 16);
  g.fillRect(114, 56, 14, 16);
  g.fillStyle = 'rgba(220,235,255,0.1)';
  g.fillRect(0, 0, 128, 3);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface TeamMats {
  torso: THREE.MeshStandardMaterial;
  arms: THREE.MeshStandardMaterial;
  hands: THREE.MeshStandardMaterial;
  vest: THREE.MeshStandardMaterial;
  legs: THREE.MeshStandardMaterial;
  boots: THREE.MeshStandardMaterial;
  belt: THREE.MeshStandardMaterial;
  head: THREE.MeshStandardMaterial;
  gear: THREE.MeshStandardMaterial;
  visor: THREE.MeshStandardMaterial;
}

const matsCache = new Map<Team, TeamMats>();

function std(color: number, roughness = 0.9): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

function cloth(base: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: clothTexture(base), roughness: 0.95, metalness: 0 });
}

export function teamMats(team: Team): TeamMats {
  const cached = matsCache.get(team);
  if (cached) return cached;
  let m: TeamMats;
  if (team === 'T') {
    const shirt = cloth('#8a7a4e');
    m = {
      torso: shirt,
      arms: shirt,
      hands: std(0xd9b38c, 0.85),
      vest: new THREE.MeshStandardMaterial({ map: vestTextureT(), roughness: 0.95, metalness: 0 }),
      legs: cloth('#4b4b52'),
      boots: std(0x5a3c22, 0.95),
      belt: std(0x3a2d1c, 0.9),
      head: cloth('#c2a06e'),
      gear: std(0x26201a, 0.8),
      visor: std(0x26201a, 0.8),
    };
  } else {
    const uniform = cloth('#2c3854');
    m = {
      torso: uniform,
      arms: uniform,
      hands: std(0x1f2940, 0.9),
      vest: new THREE.MeshStandardMaterial({ map: vestTextureCT(), roughness: 0.95, metalness: 0 }),
      legs: cloth('#3c4659'),
      boots: std(0x1d1f24, 0.9),
      belt: std(0x1c2436, 0.9),
      head: std(0x33405c, 0.9),
      gear: std(0x262b33, 0.6),
      visor: std(0x0d0f14, 0.35),
    };
  }
  matsCache.set(team, m);
  return m;
}

export interface RifleMats {
  metal: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  mag: THREE.MeshStandardMaterial;
  m4Body: THREE.MeshStandardMaterial;
  m4Furn: THREE.MeshStandardMaterial;
  m4Mag: THREE.MeshStandardMaterial;
  awpBody: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
}

let rifleMatsCache: RifleMats | null = null;

export function rifleMats(): RifleMats {
  if (!rifleMatsCache) {
    rifleMatsCache = {
      metal: std(0x232325, 0.6),
      wood: std(0x6b432a, 0.85),
      mag: std(0x7a4b22, 0.65),
      m4Body: std(0x23252a, 0.6),
      m4Furn: std(0x2e3138, 0.65),
      m4Mag: std(0x3a3d44, 0.6),
      awpBody: std(0x3d4a33, 0.7),
      dark: std(0x17181b, 0.5),
    };
  }
  return rifleMatsCache;
}

const geoCache = new Map<string, THREE.BufferGeometry>();

export function boxGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const key = `b${w},${h},${d}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(key, g);
  }
  return g;
}

export function sphereGeo(r: number): THREE.BufferGeometry {
  const key = `s${r}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.SphereGeometry(r, 12, 9);
    geoCache.set(key, g);
  }
  return g;
}

export function cylGeo(r: number, len: number): THREE.BufferGeometry {
  const key = `c${r},${len}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(r, r, len, 10);
    geoCache.set(key, g);
  }
  return g;
}

export function nameSprite(name: string, team: Team): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.45)';
  const w = Math.min(244, g.measureText(name).width + 24);
  g.beginPath();
  g.roundRect(128 - w / 2, 8, w, 48, 10);
  g.fill();
  g.fillStyle = team === 'T' ? '#ffce85' : '#a9ccff';
  g.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(1.9, 0.48, 1);
  sprite.position.y = 2.25;
  return sprite;
}
