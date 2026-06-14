import * as THREE from 'three';
import { DEFAULT_WEAPON, EYE_HEIGHT } from '@cs/shared';
import type { Team, WeaponType } from '@cs/shared';
import { boxGeo, cylGeo, nameSprite, rifleMats, sphereGeo, teamMats } from './playerAssets.js';

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

    for (const side of [-1, 1]) {
      add(boxGeo(0.21, 0.13, 0.32), m.boots, side * 0.15, 0.065, -0.02);
      add(boxGeo(0.22, 0.76, 0.24), m.legs, side * 0.15, 0.51, 0);
    }
    add(boxGeo(0.52, 0.1, 0.28), m.belt, 0, 0.93, 0);
    add(boxGeo(0.58, 0.52, 0.3), m.torso, 0, 1.22, 0);
    add(boxGeo(0.62, 0.42, 0.38), m.vest, 0, 1.24, 0);
    add(boxGeo(0.14, 0.12, 0.26), m.arms, 0.34, 1.4, 0);
    add(boxGeo(0.14, 0.12, 0.26), m.arms, -0.34, 1.4, 0);

    this.headGroup.position.y = EYE_HEIGHT;
    if (team === 'T') {
      add(boxGeo(0.32, 0.34, 0.32), m.head, 0, 0, 0, this.headGroup);
      add(boxGeo(0.335, 0.07, 0.335), m.visor, 0, 0.035, 0, this.headGroup);
    } else {
      add(boxGeo(0.3, 0.32, 0.3), m.head, 0, -0.01, 0, this.headGroup);
      const helmet = add(sphereGeo(0.21), m.gear, 0, 0.07, 0, this.headGroup);
      helmet.scale.set(1, 0.82, 1.06);
      add(boxGeo(0.27, 0.07, 0.05), m.visor, 0, 0.02, -0.155, this.headGroup);
    }
    this.body.add(this.headGroup);

    this.aim.position.y = 1.42;
    const ruArm = add(boxGeo(0.11, 0.11, 0.27), m.arms, 0.22, -0.04, -0.1, this.aim);
    ruArm.rotation.x = 0.55;
    const rfArm = add(boxGeo(0.09, 0.09, 0.24), m.hands, 0.14, -0.15, -0.25, this.aim);
    rfArm.rotation.set(0.1, -0.3, 0);
    const luArm = add(boxGeo(0.11, 0.11, 0.27), m.arms, -0.22, -0.04, -0.13, this.aim);
    luArm.rotation.set(0.5, 0.25, 0);
    const lfArm = add(boxGeo(0.09, 0.09, 0.26), m.hands, -0.1, -0.16, -0.35, this.aim);
    lfArm.rotation.set(0.05, 0.35, 0);

    const r = rifleMats();
    const prop = (): THREE.Group => {
      const g = new THREE.Group();
      g.visible = false;
      this.aim.add(g);
      return g;
    };

    const ak = prop();
    add(boxGeo(0.055, 0.085, 0.2), r.wood, 0.04, -0.14, -0.02, ak);
    add(boxGeo(0.07, 0.1, 0.4), r.metal, 0.04, -0.13, -0.3, ak);
    const mag = add(boxGeo(0.05, 0.18, 0.09), r.mag, 0.04, -0.25, -0.28, ak);
    mag.rotation.x = 0.45;
    add(boxGeo(0.075, 0.085, 0.18), r.wood, 0.04, -0.12, -0.56, ak);
    add(boxGeo(0.035, 0.04, 0.26), r.metal, 0.04, -0.115, -0.75, ak);

    const m4 = prop();
    add(boxGeo(0.05, 0.075, 0.16), r.m4Furn, 0.04, -0.135, 0, m4);
    add(boxGeo(0.055, 0.09, 0.025), r.dark, 0.04, -0.135, 0.085, m4);
    add(boxGeo(0.065, 0.09, 0.38), r.m4Body, 0.04, -0.13, -0.3, m4);
    add(boxGeo(0.03, 0.022, 0.42), r.dark, 0.04, -0.072, -0.32, m4);
    add(boxGeo(0.045, 0.17, 0.07), r.m4Mag, 0.04, -0.245, -0.26, m4);
    add(boxGeo(0.06, 0.06, 0.24), r.m4Furn, 0.04, -0.12, -0.56, m4);
    add(boxGeo(0.026, 0.026, 0.16), r.dark, 0.04, -0.115, -0.74, m4);
    add(boxGeo(0.038, 0.038, 0.055), r.dark, 0.04, -0.115, -0.85, m4);

    const awp = prop();
    add(boxGeo(0.055, 0.1, 0.2), r.awpBody, 0.04, -0.14, 0, awp);
    add(boxGeo(0.045, 0.03, 0.12), r.dark, 0.04, -0.082, 0.01, awp);
    add(boxGeo(0.06, 0.09, 0.52), r.awpBody, 0.04, -0.125, -0.34, awp);
    add(boxGeo(0.045, 0.07, 0.09), r.dark, 0.04, -0.19, -0.28, awp);
    const awpBarrel = add(cylGeo(0.016, 0.5), r.dark, 0.04, -0.112, -0.84, awp);
    awpBarrel.rotation.x = Math.PI / 2;
    const awpScope = add(cylGeo(0.024, 0.3), r.dark, 0.04, -0.052, -0.32, awp);
    awpScope.rotation.x = Math.PI / 2;
    const awpBell = add(cylGeo(0.032, 0.07), r.dark, 0.04, -0.052, -0.48, awp);
    awpBell.rotation.x = Math.PI / 2;
    add(boxGeo(0.07, 0.016, 0.016), r.dark, 0.095, -0.115, -0.16, awp);

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
      this.body.rotation.x = 0;
      this.body.position.y = 0;
      this.headGroup.rotation.x = pitch * 0.6;
      this.aim.rotation.x = pitch;
      this.tag.visible = true;
    } else {
      this.body.rotation.x = Math.PI / 2;
      this.body.position.y = 0.25;
      this.headGroup.rotation.x = 0;
      this.aim.rotation.x = 0;
      this.tag.visible = false;
    }
  }
}

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
