import * as THREE from 'three';
import type { Vec3 } from '@cs/shared';

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

  for (let i = 0; i < 9; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 12;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(120,104,80,0.3)' : 'rgba(196,180,150,0.28)';
    g.beginPath();
    g.arc(24 + Math.cos(ang) * r, 24 + Math.sin(ang) * r, 1.5 + Math.random() * 3.5, 0, Math.PI * 2);
    g.fill();
  }

  for (let i = 0; i < 30; i++) {
    g.fillStyle = 'rgba(90,78,58,0.35)';
    g.fillRect(Math.random() * 48, Math.random() * 48, 1, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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

    const mat = new THREE.SpriteMaterial({ map: this.impactTex, transparent: true, depthWrite: false });
    mat.rotation = Math.random() * Math.PI * 2;
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(b);
    sprite.scale.set(0.3, 0.3, 1);
    this.scene.add(sprite);
    this.impacts.push({ sprite, life: IMPACT_LIFE });

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
