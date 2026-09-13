import * as THREE from "three";
import { WorldObject } from "./WorldObject.js";

/**
 * CosmicTV — A 3D Retro-Futuristic Flying Television Set in Space.
 * Features an active web browser screen, rabbit-ear antennae,
 * and antigravity repulsor thrusters that pilots can fly up to and surf the web!
 */
export class CosmicTV extends WorldObject {
  constructor(
    id = "cosmic_tv_sol",
    position = new THREE.Vector3(-38, 14, -70),
    initialUrl = "https://en.wikipedia.org/wiki/Solar_System"
  ) {
    super(id, "Cosmic Web TV");
    this.targetPos = position.clone();
    this.baseY = position.y;
    this.currentUrl = initialUrl;
    this.currentTitle = "Wikipedia: Solar System";
    this.interactionRadius = 32.0;
    this.isInteractive = true;
    this.inRange = false;

    this.screenCanvas = null;
    this.screenCtx = null;
    this.screenTexture = null;
    this.screenMesh = null;
    this.antennaeTips = [];
    this.thrusterGlows = [];
    this.lastCanvasUpdate = 0;

    this.buildGeometry();
  }

  buildGeometry() {
    this.mesh.position.copy(this.targetPos);

    // 1. Materials
    const cabinetMat = new THREE.MeshStandardMaterial({
      color: 0x271912, // Rich vintage woodgrain mahogany
      roughness: 0.55,
      metalness: 0.15,
    });
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Polished brass bezel
      metalness: 0.85,
      roughness: 0.2,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.95,
      roughness: 0.1,
    });
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.7,
      metalness: 0.3,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const purpleGlowMat = new THREE.MeshBasicMaterial({ color: 0x9d00ff });

    // 2. Main TV Cabinet Shell
    const cabinetGeo = new THREE.BoxGeometry(16, 12, 10);
    const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
    this.mesh.add(cabinet);

    // Golden Front Bezel Frame
    const bezelGeo = new THREE.BoxGeometry(16.2, 12.2, 0.4);
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.position.z = 5.1;
    this.mesh.add(bezel);

    // 3. CRT Display Screen
    if (typeof document !== "undefined") {
      this.screenCanvas = document.createElement("canvas");
      this.screenCanvas.width = 1024;
      this.screenCanvas.height = 768;
      this.screenCtx = this.screenCanvas.getContext("2d");
      this.drawScreenCanvas();

      this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
      this.screenTexture.minFilter = THREE.LinearFilter;
    }

    const screenGeo = new THREE.BoxGeometry(11.2, 8.8, 0.5);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      color: 0xffffff,
    });
    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.set(-1.8, 0, 5.25);
    this.mesh.add(this.screenMesh);

    // Screen Glass Curvature / Vignette Glare
    const glareGeo = new THREE.PlaneGeometry(11.2, 8.8);
    const glareMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
    });
    const glare = new THREE.Mesh(glareGeo, glareMat);
    glare.position.set(-1.8, 0, 5.52);
    this.mesh.add(glare);

    // 4. Right Side Control Panel (Dials, Knobs, Buttons, Speaker)
    const controlPanelGeo = new THREE.BoxGeometry(3.0, 9.4, 0.6);
    const controlPanel = new THREE.Mesh(controlPanelGeo, panelMat);
    controlPanel.position.set(5.7, 0, 5.2);
    this.mesh.add(controlPanel);

    // Rotary Channel Dial
    const dialGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.45, 16);
    dialGeo.rotateX(Math.PI / 2);
    const dial1 = new THREE.Mesh(dialGeo, bezelMat);
    dial1.position.set(5.7, 3.0, 5.55);
    this.mesh.add(dial1);

    // Rotary Volume Dial
    const dial2 = new THREE.Mesh(dialGeo, bezelMat);
    dial2.position.set(5.7, 1.0, 5.55);
    this.mesh.add(dial2);

    // Speaker Grill Slats
    for (let i = 0; i < 6; i++) {
      const slatGeo = new THREE.BoxGeometry(2.2, 0.15, 0.2);
      const slat = new THREE.Mesh(slatGeo, cabinetMat);
      slat.position.set(5.7, -1.0 - i * 0.45, 5.55);
      this.mesh.add(slat);
    }

    // Power Indicator Lamp (Neon Green Glow)
    const lampGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(5.7, -3.8, 5.55);
    this.mesh.add(lamp);

    // 5. Classic Rabbit Ear Antennae
    [-1.6, 1.6].forEach((x, idx) => {
      const angle = idx === 0 ? 0.38 : -0.38;
      const antGroup = new THREE.Group();
      antGroup.position.set(x, 6.0, 0);

      // Antenna rod
      const rodGeo = new THREE.CylinderGeometry(0.09, 0.14, 7.5, 8);
      const rod = new THREE.Mesh(rodGeo, chromeMat);
      rod.position.y = 3.5;
      rod.rotation.z = angle;
      antGroup.add(rod);

      // Glowing plasma ball on top
      const tipGeo = new THREE.SphereGeometry(0.35, 14, 14);
      const tip = new THREE.Mesh(tipGeo, glowMat);
      tip.position.set(Math.sin(-angle) * 7.0, 7.0, 0);
      antGroup.add(tip);
      this.antennaeTips.push(tip);

      this.mesh.add(antGroup);
    });

    // 6. Antigravity Repulsor Thrusters underneath
    [[-6, -6, -3], [6, -6, -3], [-6, -6, 3], [6, -6, 3]].forEach(([x, y, z]) => {
      const thrusterGeo = new THREE.CylinderGeometry(0.85, 1.2, 1.2, 12);
      const thruster = new THREE.Mesh(thrusterGeo, panelMat);
      thruster.position.set(x, y, z);
      this.mesh.add(thruster);

      // Glowing repulsor plasma ring
      const ringGeo = new THREE.TorusGeometry(0.9, 0.14, 8, 16);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, glowMat);
      ring.position.set(x, y - 0.6, z);
      this.mesh.add(ring);
      this.thrusterGlows.push(ring);

      const light = new THREE.PointLight(0x00f0ff, 1.5, 18);
      light.position.set(x, y - 1.2, z);
      this.mesh.add(light);
    });

    // 7. Overhead 3D Holographic Nametag Billboard
    this.buildNametag();
  }

  buildNametag() {
    if (typeof document === "undefined") return;

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(10, 15, 28, 0.85)";
    ctx.roundRect(10, 10, 492, 108, 16);
    ctx.fill();
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#00f0ff";
    ctx.font = "bold 32px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("📺 COSMIC WEB TV", 256, 52);

    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 20px 'JetBrains Mono', monospace";
    ctx.fillText("PRESS [E] TO TUNE & BROWSE", 256, 92);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    this.nametagSprite = new THREE.Sprite(spriteMat);
    this.nametagSprite.position.set(0, 14.5, 0);
    this.nametagSprite.scale.set(24, 6, 1);
    this.mesh.add(this.nametagSprite);
  }

  drawScreenCanvas() {
    if (!this.screenCtx) return;
    const ctx = this.screenCtx;
    const w = 1024;
    const h = 768;

    // Dark cyber CRT background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#08101e");
    bgGrad.addColorStop(1, "#030712");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Neon CRT Border glow
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 12;
    ctx.strokeRect(16, 16, w - 32, h - 32);

    // Header bar
    ctx.fillStyle = "rgba(0, 240, 255, 0.15)";
    ctx.fillRect(20, 20, w - 40, 90);
    ctx.fillStyle = "#00f0ff";
    ctx.font = "bold 38px 'Orbitron', monospace";
    ctx.fillText("📺 MULTIVERSE MAGIC // COSMIC TV", 50, 78);

    // Channel indicator
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 28px 'JetBrains Mono', monospace";
    ctx.fillText("CH-01 [LIVE WEB FEED]", w - 360, 78);

    // Web Browser Address Box
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(50, 140, w - 100, 70);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.strokeRect(50, 140, w - 100, 70);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "22px 'JetBrains Mono', monospace";
    ctx.fillText("TUNED URL:", 70, 184);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 24px 'JetBrains Mono', monospace";
    const displayUrl = this.currentUrl.length > 45 ? this.currentUrl.slice(0, 45) + "..." : this.currentUrl;
    ctx.fillText(displayUrl, 220, 184);

    // Main Web Page Preview Window
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(50, 240, w - 100, 360);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.strokeRect(50, 240, w - 100, 360);

    // Page Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px 'Orbitron', sans-serif";
    ctx.fillText(this.currentTitle || "Web Page", 90, 320);

    // Preview snippet
    ctx.fillStyle = "#94a3b8";
    ctx.font = "24px 'JetBrains Mono', monospace";
    ctx.fillText("Active Hypermedia Data Stream", 90, 375);
    ctx.fillText("Click or fly close and press [E] to surf any website.", 90, 420);
    ctx.fillText("Supported: Wikipedia, NASA, Retro Web, Docs, News & more!", 90, 465);

    // CTA Banner
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 32px 'JetBrains Mono', monospace";
    ctx.fillText("👉 PRESS [E] TO TUNE & INTERACT", 90, 540);

    // Scanlines overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    for (let y = 0; y < h; y += 8) {
      ctx.fillRect(0, y, w, 4);
    }
  }

  setChannel(url, title = "") {
    this.currentUrl = url;
    this.currentTitle = title || url;
    this.drawScreenCanvas();
    if (this.screenTexture) {
      this.screenTexture.needsUpdate = true;
    }
  }

  update(delta, time, playerPosition, playerSystem, audioSystem, overlay) {
    // 1. Antigravity floating bobbing motion
    this.mesh.position.y = this.baseY + Math.sin(time * 1.5) * 0.9;
    this.mesh.rotation.y = Math.sin(time * 0.4) * 0.08;
    this.mesh.rotation.z = Math.sin(time * 0.8) * 0.025;

    // 2. Pulse thruster rings
    const glowScale = 1.0 + Math.sin(time * 6.0) * 0.12;
    this.thrusterGlows.forEach((ring) => {
      ring.scale.set(glowScale, glowScale, 1.0);
    });

    // 3. Check proximity to pilot
    if (playerPosition) {
      const dist = playerPosition.distanceTo(this.mesh.position);
      if (dist <= this.interactionRadius) {
        if (!this.inRange) {
          this.inRange = true;
          const banner = document.getElementById("jumpgate-proximity-banner");
          if (banner) {
            banner.innerHTML = `<span style="color:#ffd700;font-weight:700;">📺 COSMIC WEB TV IN RANGE</span><br/><span style="color:#00f0ff;font-size:11px;">CLICK HERE OR PRESS <b>[E]</b> TO TUNE &amp; SURF THE WEB</span>`;
            banner.style.display = "block";
            banner.onclick = () => this.onInteract(playerSystem);
          }
        }
      } else if (this.inRange) {
        this.inRange = false;
        const banner = document.getElementById("jumpgate-proximity-banner");
        if (banner && banner.innerHTML.includes("COSMIC")) {
          banner.style.display = "none";
          banner.onclick = null;
        }
      }
    }
  }

  onInteract(playerSystem) {
    // Trigger opening browser terminal
    if (typeof window !== "undefined") {
      if (window.multiverseApp?.overlay) {
        window.multiverseApp.overlay.openCosmicTVModal();
      } else {
        const modal = document.getElementById("cosmic-tv-modal");
        if (modal) modal.style.display = "flex";
      }
    }
  }
}
