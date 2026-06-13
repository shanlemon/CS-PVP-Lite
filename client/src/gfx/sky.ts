import * as THREE from 'three';

// Desert sky and lighting for the Dust2-style arena. The dome texture is a
// procedural canvas (no external assets — Discord activity CSP).

function buildSkyTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;

  // Vertical gradient: soft blue zenith down to bright warm haze at the
  // horizon (the sphere's equator sits at v = 0.5, i.e. y = 256). Below the
  // horizon the haze color continues so nothing odd peeks past the walls.
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#4f8ecf');
  grad.addColorStop(0.22, '#6da6da');
  grad.addColorStop(0.38, '#93bce2');
  grad.addColorStop(0.46, '#c3d8e9');
  grad.addColorStop(0.5, '#e2e0d2');
  grad.addColorStop(1.0, '#e2e0d2');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  // Low bright sun glow — very subtle, kept well away from the x=0/x=1024
  // wrap line so the dome has no horizontal seam.
  const sunX = 330;
  const sunY = 226;
  let glow = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, 190);
  glow.addColorStop(0, 'rgba(255,246,218,0.40)');
  glow.addColorStop(0.4, 'rgba(255,242,208,0.16)');
  glow.addColorStop(1, 'rgba(255,242,208,0)');
  g.fillStyle = glow;
  g.fillRect(sunX - 190, sunY - 190, 380, 380);
  // Hot core.
  glow = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, 46);
  glow.addColorStop(0, 'rgba(255,252,238,0.55)');
  glow.addColorStop(1, 'rgba(255,250,230,0)');
  g.fillStyle = glow;
  g.fillRect(sunX - 46, sunY - 46, 92, 92);

  // Soft wispy cloud streaks near the horizon, built from layered low-alpha
  // ellipses. Each ellipse is also drawn at x ± w so clouds wrap seamlessly.
  const drawEllipse = (x: number, y: number, rx: number, ry: number, a: number): void => {
    g.fillStyle = `rgba(255,255,255,${a})`;
    for (const ox of [-w, 0, w]) {
      if (x + ox + rx < 0 || x + ox - rx > w) continue;
      g.beginPath();
      g.ellipse(x + ox, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
  };

  const clouds = 8;
  for (let i = 0; i < clouds; i++) {
    const cx = Math.random() * w;
    const cy = 176 + Math.random() * 72; // 176..248, hugging the horizon
    // Closer to the horizon → flatter and more opaque, like the reference.
    const t = (cy - 176) / 72;
    const baseAlpha = 0.06 + t * 0.12;
    const puffs = 5 + Math.floor(Math.random() * 5);
    let px = cx - puffs * 18;
    for (let p = 0; p < puffs; p++) {
      const rx = 36 + Math.random() * 58;
      const ry = (3.5 + Math.random() * 5) * (1 - t * 0.35);
      const py = cy + (Math.random() - 0.5) * 7;
      // Layered passes: a broad faint wash, then a brighter core streak.
      drawEllipse(px, py, rx, ry * 1.8, baseAlpha * 0.5);
      drawEllipse(px, py, rx * 0.7, ry, baseAlpha);
      px += rx * (0.6 + Math.random() * 0.5);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function applySky(scene: THREE.Scene): void {
  const geo = new THREE.SphereGeometry(240, 32, 16);
  const mat = new THREE.MeshBasicMaterial({
    map: buildSkyTexture(),
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -1;
  scene.add(dome);

  scene.fog = new THREE.Fog(0xdfe6ea, 90, 230);
  scene.background = null;
}

export function applyLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  // Neutral tone mapping keeps colors saturated (ACES washes them grey);
  // exposure + light levels tuned for a bright desert noon.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Cool sky bounce vs warm sand bounce.
  const hemi = new THREE.HemisphereLight(0xd4e4f5, 0xb89e6e, 0.75);
  scene.add(hemi);

  // Warm desert sun.
  const sun = new THREE.DirectionalLight(0xffedc8, 1.95);
  sun.position.set(28, 44, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 130;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  // The ortho bounds above replace the tiny defaults — without this call the
  // projection matrix keeps the defaults and almost nothing receives shadow.
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);

  // Faint warm fill so shadowed areas never go pitch black.
  const ambient = new THREE.AmbientLight(0xfff2e0, 0.14);
  scene.add(ambient);
}
