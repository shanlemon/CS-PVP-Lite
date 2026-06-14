import * as THREE from 'three';
import { DEFAULT_WEAPON, WEAPONS } from '@cs/shared';
import type { WeaponType } from '@cs/shared';
import { buildViewmodelGuns, makeFlashTexture, type GunRig } from './viewmodelGuns.js';

/** 0->1 smoothstep ramp of t across [a, b]. */
function ramp(t: number, a: number, b: number): number {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

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
    this.guns = buildViewmodelGuns();
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
    this.group.scale.setScalar(0.85);
    camera.add(this.group);
  }

  setWeapon(type: WeaponType): void {
    if (this.current === type) return;
    this.current = type;
    this.reloadT = -1;
    for (const id of Object.keys(this.guns) as WeaponType[]) {
      this.guns[id].group.visible = id === type;
      this.resetRigPose(this.guns[id]);
    }
    this.muzzleFlash.position.copy(this.guns[type].tip.position);
    if (type === 'awp') {
      this.kickStrength = 1.1;
      this.kickCap = 1.3;
      this.recoverRate = 4.5;
    } else {
      this.kickStrength = 0.45;
      this.kickCap = 1;
      this.recoverRate = 6;
    }
  }

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
    const dip = ramp(t, 0, 0.12) * (1 - ramp(t, 0.86, 1));
    const tug = ramp(t, 0.84, 0.88) * (1 - ramp(t, 0.88, 0.96));

    if (rig.mag) {
      const out = ramp(t, 0.12, 0.34);
      const inn = ramp(t, 0.5, 0.72);
      const k = out * (1 - inn);
      rig.mag.position.y = rig.magHome.y - 0.26 * k;
      rig.mag.position.z = rig.magHome.z + 0.08 * k;
      rig.mag.rotation.x = rig.magHome.rotX + 0.55 * k;
      rig.mag.visible = !(t > 0.38 && t < 0.5);
    }
    if (rig.bolt) {
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
    this.bobT += dt * (1 + moveSpeed * 0.55);
    this.swayT += dt;
    const bobAmount = Math.min(1, moveSpeed / 5);
    const bob = Math.sin(this.bobT * 2.2) * 0.005 * bobAmount;
    const bobX = Math.sin(this.bobT * 1.1) * 0.003 * bobAmount;
    const swayX = Math.sin(this.swayT * 0.8) * 0.0035;
    const swayY = Math.sin(this.swayT * 1.1 + 1.7) * 0.0025;

    const rl = this.reloadPose(this.guns[this.current], reloading, dt);

    this.group.position.set(BASE_X + swayX + bobX, BASE_Y + bob + swayY + rl.y, BASE_Z + this.recoil * 0.06);
    this.group.rotation.x = this.recoil * 0.12 + rl.rotX;
    this.group.rotation.z = Math.sin(this.swayT * 0.6) * 0.004 + rl.rotZ;
    this.muzzleFlash.visible = performance.now() < this.flashUntil;
  }
}
