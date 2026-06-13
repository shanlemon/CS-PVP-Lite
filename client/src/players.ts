import * as THREE from 'three';
import { DEFAULT_WEAPON, EYE_HEIGHT } from '@cs/shared';
import type { Team, WeaponType } from '@cs/shared';

// ---------------------------------------------------------------------------
// Procedural textures (canvas only, shared across avatars via caches below)
// ---------------------------------------------------------------------------

/** Generic cloth: base color + large mottling + fine speckle + faint weave. */
function clothTexture(base: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 64);
  // large mottling
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
  // fine speckle
  for (let i = 0; i < 170; i++) {
    g.fillStyle = Math.random() < 0.55 ? 'rgba(0,0,0,0.11)' : 'rgba(255,255,255,0.05)';
    g.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
  }
  // faint vertical weave streaks
  g.fillStyle = 'rgba(0,0,0,0.04)';
  for (let x = 0; x < 64; x += 4) {
    g.fillRect(x, 0, 1, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** T tactical vest: dark brown canvas with painted pouches, straps, edge wear. */
function vestTextureT(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#42321f';
  g.fillRect(0, 0, 128, 128);
  // large mottling
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
  // fine speckle
  for (let i = 0; i < 300; i++) {
    g.fillStyle = Math.random() < 0.55 ? 'rgba(0,0,0,0.12)' : 'rgba(255,235,200,0.05)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  // shoulder straps
  g.fillStyle = '#332718';
  g.fillRect(20, 0, 12, 44);
  g.fillRect(96, 0, 12, 44);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(20, 0, 2, 44);
  g.fillRect(106, 0, 2, 44);
  // pouch row
  for (let p = 0; p < 3; p++) {
    const x = 14 + p * 36;
    g.fillStyle = '#4f3c25';
    g.fillRect(x, 64, 28, 36);
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 2;
    g.strokeRect(x + 1, 65, 26, 34);
    // flap with top highlight
    g.fillStyle = '#3a2c1b';
    g.fillRect(x, 60, 28, 12);
    g.fillStyle = 'rgba(255,235,200,0.1)';
    g.fillRect(x, 60, 28, 2);
    // buckle
    g.fillStyle = '#241b10';
    g.fillRect(x + 12, 68, 4, 6);
  }
  // bottom edge wear
  g.fillStyle = 'rgba(255,225,180,0.08)';
  g.fillRect(0, 124, 128, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** CT armored vest: blue-grey with painted plate carrier, seams and straps. */
function vestTextureCT(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5b6878';
  g.fillRect(0, 0, 128, 128);
  // large mottling
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
  // fine speckle
  for (let i = 0; i < 280; i++) {
    g.fillStyle = Math.random() < 0.55 ? 'rgba(0,0,0,0.1)' : 'rgba(225,238,255,0.05)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  // central armor plate
  g.fillStyle = '#65748a';
  g.beginPath();
  g.roundRect(26, 24, 76, 78, 8);
  g.fill();
  g.strokeStyle = 'rgba(10,16,26,0.55)';
  g.lineWidth = 3;
  g.stroke();
  // plate seams
  g.strokeStyle = 'rgba(10,16,26,0.3)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(30, 52);
  g.lineTo(98, 52);
  g.moveTo(30, 78);
  g.lineTo(98, 78);
  g.stroke();
  // admin pouch on the plate
  g.fillStyle = '#4d5a6b';
  g.fillRect(48, 30, 32, 14);
  g.strokeStyle = 'rgba(10,16,26,0.4)';
  g.lineWidth = 1.5;
  g.strokeRect(48, 30, 32, 14);
  // side straps
  g.fillStyle = '#3e4856';
  g.fillRect(0, 56, 14, 16);
  g.fillRect(114, 56, 14, 16);
  // top edge highlight
  g.fillStyle = 'rgba(220,235,255,0.1)';
  g.fillRect(0, 0, 128, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Shared materials / geometry caches (avatars rebuild on team change, so all
// geometries and materials live in module-level caches to avoid leaks)
// ---------------------------------------------------------------------------

interface TeamMats {
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

function teamMats(team: Team): TeamMats {
  const cached = matsCache.get(team);
  if (cached) return cached;
  let m: TeamMats;
  if (team === 'T') {
    const shirt = cloth('#8a7a4e'); // tan/olive shirt, rolled sleeves
    m = {
      torso: shirt,
      arms: shirt,
      hands: std(0xd9b38c, 0.85), // bare forearms (rolled sleeves)
      vest: new THREE.MeshStandardMaterial({ map: vestTextureT(), roughness: 0.95, metalness: 0 }),
      legs: cloth('#4b4b52'), // dark grey cargo pants
      boots: std(0x5a3c22, 0.95), // brown boots
      belt: std(0x3a2d1c, 0.9),
      head: cloth('#c2a06e'), // tan balaclava
      gear: std(0x26201a, 0.8),
      visor: std(0x26201a, 0.8), // dark eye-slit band
    };
  } else {
    const uniform = cloth('#2c3854'); // dark navy uniform
    m = {
      torso: uniform,
      arms: uniform,
      hands: std(0x1f2940, 0.9), // gloved forearms
      vest: new THREE.MeshStandardMaterial({ map: vestTextureCT(), roughness: 0.95, metalness: 0 }),
      legs: cloth('#3c4659'), // lighter grey-blue so legs separate from the navy torso
      boots: std(0x1d1f24, 0.9),
      belt: std(0x1c2436, 0.9),
      head: std(0x33405c, 0.9),
      gear: std(0x262b33, 0.6), // dark helmet
      visor: std(0x0d0f14, 0.35), // visor strip
    };
  }
  matsCache.set(team, m);
  return m;
}

interface RifleMats {
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

function rifleMats(): RifleMats {
  if (!rifleMatsCache) {
    rifleMatsCache = {
      metal: std(0x232325, 0.6),
      wood: std(0x6b432a, 0.85),
      mag: std(0x7a4b22, 0.65),
      m4Body: std(0x23252a, 0.6), // cool grey-black so the M4 reads distinct
      m4Furn: std(0x2e3138, 0.65),
      m4Mag: std(0x3a3d44, 0.6),
      awpBody: std(0x3d4a33, 0.7), // olive green — readable at a glance
      dark: std(0x17181b, 0.5),
    };
  }
  return rifleMatsCache;
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

function sphereGeo(r: number): THREE.BufferGeometry {
  const key = `s${r}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.SphereGeometry(r, 12, 9);
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

// ---------------------------------------------------------------------------
// Nametag sprite
// ---------------------------------------------------------------------------

function nameSprite(name: string, team: Team): THREE.Sprite {
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

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

class Avatar {
  group = new THREE.Group();
  private body = new THREE.Group();
  private headGroup = new THREE.Group();
  private aim = new THREE.Group();
  private tag: THREE.Sprite;
  private props: Record<WeaponType, THREE.Group>;
  private weapon: WeaponType = DEFAULT_WEAPON;

  constructor(name: string, team: Team) {
    const m = teamMats(team);
    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = this.body,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // legs + boots — spread apart so the silhouette clearly reads as two legs
    for (const side of [-1, 1]) {
      add(boxGeo(0.21, 0.13, 0.32), m.boots, side * 0.15, 0.065, -0.02);
      add(boxGeo(0.22, 0.76, 0.24), m.legs, side * 0.15, 0.51, 0);
    }
    // belt, torso, vest — shoulders wider than hips (CS-style silhouette)
    add(boxGeo(0.52, 0.1, 0.28), m.belt, 0, 0.93, 0);
    add(boxGeo(0.58, 0.52, 0.3), m.torso, 0, 1.22, 0);
    add(boxGeo(0.62, 0.42, 0.38), m.vest, 0, 1.24, 0);
    // shoulder caps
    add(boxGeo(0.14, 0.12, 0.26), m.arms, 0.34, 1.4, 0);
    add(boxGeo(0.14, 0.12, 0.26), m.arms, -0.34, 1.4, 0);

    // head (group so headgear pitches together)
    this.headGroup.position.y = EYE_HEIGHT;
    if (team === 'T') {
      add(boxGeo(0.32, 0.34, 0.32), m.head, 0, 0, 0, this.headGroup);
      add(boxGeo(0.335, 0.07, 0.335), m.visor, 0, 0.035, 0, this.headGroup); // eye-slit band
    } else {
      add(boxGeo(0.3, 0.32, 0.3), m.head, 0, -0.01, 0, this.headGroup);
      const helmet = add(sphereGeo(0.21), m.gear, 0, 0.07, 0, this.headGroup);
      helmet.scale.set(1, 0.82, 1.06);
      add(boxGeo(0.27, 0.07, 0.05), m.visor, 0, 0.02, -0.155, this.headGroup); // visor strip
    }
    this.body.add(this.headGroup);

    // arms + rifle on the aim pivot (follows player pitch)
    this.aim.position.y = 1.42;
    const ruArm = add(boxGeo(0.11, 0.11, 0.27), m.arms, 0.22, -0.04, -0.1, this.aim);
    ruArm.rotation.x = 0.55;
    const rfArm = add(boxGeo(0.09, 0.09, 0.24), m.hands, 0.14, -0.15, -0.25, this.aim);
    rfArm.rotation.set(0.1, -0.3, 0);
    const luArm = add(boxGeo(0.11, 0.11, 0.27), m.arms, -0.22, -0.04, -0.13, this.aim);
    luArm.rotation.set(0.5, 0.25, 0);
    const lfArm = add(boxGeo(0.09, 0.09, 0.26), m.hands, -0.1, -0.16, -0.35, this.aim);
    lfArm.rotation.set(0.05, 0.35, 0);

    // rifle props: all three variants are built once, visibility toggled
    const r = rifleMats();
    const prop = (): THREE.Group => {
      const g = new THREE.Group();
      g.visible = false;
      this.aim.add(g);
      return g;
    };

    // AK-47: wood furniture + curved magazine
    const ak = prop();
    add(boxGeo(0.055, 0.085, 0.2), r.wood, 0.04, -0.14, -0.02, ak); // stock
    add(boxGeo(0.07, 0.1, 0.4), r.metal, 0.04, -0.13, -0.3, ak); // receiver
    const mag = add(boxGeo(0.05, 0.18, 0.09), r.mag, 0.04, -0.25, -0.28, ak);
    mag.rotation.x = 0.45; // curved magazine
    add(boxGeo(0.075, 0.085, 0.18), r.wood, 0.04, -0.12, -0.56, ak); // wood handguard
    add(boxGeo(0.035, 0.04, 0.26), r.metal, 0.04, -0.115, -0.75, ak); // barrel

    // M4A4: black carbine — top rail, STRAIGHT grey mag, flash hider
    const m4 = prop();
    add(boxGeo(0.05, 0.075, 0.16), r.m4Furn, 0.04, -0.135, 0, m4); // stock
    add(boxGeo(0.055, 0.09, 0.025), r.dark, 0.04, -0.135, 0.085, m4); // buttpad
    add(boxGeo(0.065, 0.09, 0.38), r.m4Body, 0.04, -0.13, -0.3, m4); // receiver
    add(boxGeo(0.03, 0.022, 0.42), r.dark, 0.04, -0.072, -0.32, m4); // top rail
    add(boxGeo(0.045, 0.17, 0.07), r.m4Mag, 0.04, -0.245, -0.26, m4); // straight mag
    add(boxGeo(0.06, 0.06, 0.24), r.m4Furn, 0.04, -0.12, -0.56, m4); // handguard
    add(boxGeo(0.026, 0.026, 0.16), r.dark, 0.04, -0.115, -0.74, m4); // barrel
    add(boxGeo(0.038, 0.038, 0.055), r.dark, 0.04, -0.115, -0.85, m4); // flash hider

    // AWP: noticeably longer olive body + scope tube + heavy barrel
    const awp = prop();
    add(boxGeo(0.055, 0.1, 0.2), r.awpBody, 0.04, -0.14, 0, awp); // thick stock
    add(boxGeo(0.045, 0.03, 0.12), r.dark, 0.04, -0.082, 0.01, awp); // cheek riser
    add(boxGeo(0.06, 0.09, 0.52), r.awpBody, 0.04, -0.125, -0.34, awp); // long body
    add(boxGeo(0.045, 0.07, 0.09), r.dark, 0.04, -0.19, -0.28, awp); // box mag
    const awpBarrel = add(cylGeo(0.016, 0.5), r.dark, 0.04, -0.112, -0.84, awp); // heavy barrel
    awpBarrel.rotation.x = Math.PI / 2;
    const awpScope = add(cylGeo(0.024, 0.3), r.dark, 0.04, -0.052, -0.32, awp); // scope tube
    awpScope.rotation.x = Math.PI / 2;
    const awpBell = add(cylGeo(0.032, 0.07), r.dark, 0.04, -0.052, -0.48, awp); // objective bell
    awpBell.rotation.x = Math.PI / 2;
    add(boxGeo(0.07, 0.016, 0.016), r.dark, 0.095, -0.115, -0.16, awp); // bolt handle

    this.props = { ak47: ak, m4a4: m4, awp };
    this.props[this.weapon].visible = true;
    this.body.add(this.aim);

    this.group.add(this.body);
    this.tag = nameSprite(name, team);
    this.group.add(this.tag);
  }

  update(
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    alive: boolean,
    weapon: WeaponType,
  ): void {
    if (weapon !== this.weapon) {
      this.props[this.weapon].visible = false;
      this.props[weapon].visible = true;
      this.weapon = weapon;
    }
    this.group.visible = true;
    this.group.position.set(x, y, z);
    this.group.rotation.y = yaw;
    if (alive) {
      // upright pose
      this.body.rotation.x = 0;
      this.body.position.y = 0;
      this.headGroup.rotation.x = pitch * 0.6;
      this.aim.rotation.x = pitch;
      this.tag.visible = true;
    } else {
      // fallen pose: lying on its back near the ground, nametag hidden
      this.body.rotation.x = Math.PI / 2;
      this.body.position.y = 0.25;
      this.headGroup.rotation.x = 0;
      this.aim.rotation.x = 0;
      this.tag.visible = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RemoteState {
  id: string;
  name: string;
  team: Team;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  alive: boolean;
  weapon: WeaponType;
}

export class RemotePlayers {
  private avatars = new Map<string, { av: Avatar; team: Team }>();

  constructor(private scene: THREE.Scene) {}

  sync(states: RemoteState[]): void {
    const seen = new Set<string>();
    for (const s of states) {
      seen.add(s.id);
      let entry = this.avatars.get(s.id);
      if (entry && entry.team !== s.team) {
        this.scene.remove(entry.av.group);
        entry = undefined;
      }
      if (!entry) {
        entry = { av: new Avatar(s.name, s.team), team: s.team };
        this.avatars.set(s.id, entry);
        this.scene.add(entry.av.group);
      }
      entry.av.update(s.x, s.y, s.z, s.yaw, s.pitch, s.alive, s.weapon);
    }
    for (const [id, entry] of this.avatars) {
      if (!seen.has(id)) {
        this.scene.remove(entry.av.group);
        this.avatars.delete(id);
      }
    }
  }
}
