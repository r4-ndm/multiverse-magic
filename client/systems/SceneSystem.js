import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

/**
 * SceneSystem manages the 3D environment, lighting, starfield, and nebula.
 * Adheres to the "pure void" principle: no floor, no walls, pure 3D space.
 */
export class SceneSystem {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.stars = null;
    this.nebulae = [];
  }

  init(canvas) {
    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020308);
    this.scene.fog = new THREE.FogExp2(0x020308, 0.00015);

    // 2. Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 50000);
    this.camera.position.set(0, 5, 12);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // HDR studio reflections — this is what makes clearcoat paint read like GTA.
    // Background stays deep space; only the environment map uses the HDR.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const hdrUrl = new URL("../assets/hdr/studio_sunset_1k.hdr", import.meta.url).href;
    new RGBELoader().load(hdrUrl, (texture) => {
      const env = pmrem.fromEquirectangular(texture).texture;
      this.scene.environment = env;
      texture.dispose();
      pmrem.dispose();
    });

    const ambientLight = new THREE.AmbientLight(0x223044, 0.22);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff4e8, 2.05);
    sunLight.position.set(80, 140, 90);
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x9ad7ff, 1.35);
    rimLight.position.set(-90, 40, -120);
    this.scene.add(rimLight);

    const fill = new THREE.DirectionalLight(0xffffff, 0.45);
    fill.position.set(20, 30, -60);
    this.scene.add(fill);

    // 5. Starfield, nebula, and the sector beacon pilots fly home to
    this.createStarfield();
    this.createNebula();
    this.createSectorBeacon();

    // 6. Handle resizing
    window.addEventListener("resize", () => this.onWindowResize());

    return { scene: this.scene, camera: this.camera, renderer: this.renderer };
  }

  createStarfield() {
    const starCount = 8000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    const palette = [
      new THREE.Color(0xffffff), // Pure white
      new THREE.Color(0x9ed8ff), // Blue-white
      new THREE.Color(0x00f0ff), // Cyan
      new THREE.Color(0xffd4aa), // Warm star
      new THREE.Color(0xd0a9f5), // Violet star
    ];

    const innerRadius = 200;
    const outerRadius = 15000;

    for (let i = 0; i < starCount; i++) {
      // Distribute in a spherical shell
      const r = innerRadius + Math.random() * (outerRadius - innerRadius);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color variation
      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      sizes[i] = Math.random() * 2.5 + 0.8;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    // Custom circular glow point sprite
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = 32;
    spriteCanvas.height = 32;
    const ctx = spriteCanvas.getContext("2d");
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    gradient.addColorStop(0.3, "rgba(200, 230, 255, 0.8)");
    gradient.addColorStop(0.7, "rgba(50, 150, 255, 0.2)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const starTexture = new THREE.CanvasTexture(spriteCanvas);

    const material = new THREE.PointsMaterial({
      size: 3.5,
      map: starTexture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);
  }

  createSectorBeacon() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const glow = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    glow.addColorStop(0, "rgba(255, 252, 230, 1)");
    glow.addColorStop(0.12, "rgba(255, 214, 64, 0.95)");
    glow.addColorStop(0.34, "rgba(0, 240, 255, 0.28)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "rgba(255, 214, 64, 0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(64, 64, 22, 0, Math.PI * 2);
    ctx.stroke();

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      fog: false,
      sizeAttenuation: false,
      blending: THREE.AdditiveBlending,
    }));
    sprite.scale.set(0.042, 0.042, 1);
    sprite.renderOrder = 3;
    sprite.position.set(0, 0, 0);
    this.scene.add(sprite);
    this.beacon = sprite;
  }

  setBeaconFocus(stranded, distance) {
    if (!this.beacon) return;
    const near = distance < 140;
    this.beacon.visible = !near;
    const pulse = 0.9 + Math.sin(performance.now() * 0.004) * (stranded ? 0.16 : 0.06);
    const scale = (stranded ? 0.072 : 0.04) * pulse;
    this.beacon.scale.set(scale, scale, 1);
    this.beacon.material.opacity = stranded ? 1 : 0.7;
  }

  createNebula() {
    // Generate soft multi-colored volumetric nebula clouds in deep background
    const nebulaColors = [0x1a0933, 0x072844, 0x220520];
    const positions = [
      new THREE.Vector3(2500, 800, -3000),
      new THREE.Vector3(-3000, -1200, 2500),
      new THREE.Vector3(800, 2000, 3200),
    ];

    nebulaColors.forEach((colorHex, idx) => {
      const geo = new THREE.SphereGeometry(1400, 24, 24);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(positions[idx]);
      this.scene.add(mesh);
      this.nebulae.push(mesh);
    });
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  update(delta, time) {
    // Subtle celestial drift
    if (this.stars) {
      this.stars.rotation.y += delta * 0.001;
      this.stars.rotation.x += delta * 0.0005;
    }
    this.nebulae.forEach((neb, i) => {
      neb.rotation.y += delta * 0.003 * (i % 2 === 0 ? 1 : -1);
    });
  }
}
