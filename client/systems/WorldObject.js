import * as THREE from "three";

/**
 * WorldObject base class.
 * Foundation for future extensibility: planets, space stations, multiverse portals,
 * clickable web links, and user-built structures can all extend WorldObject.
 */
export class WorldObject {
  constructor(id, name = "WorldObject") {
    this.id = id;
    this.name = name;
    this.mesh = new THREE.Group();
    this.isInteractive = false;
    this.interactionRadius = 15.0;
  }

  /**
   * Called once when the object is added to the universe.
   */
  init(scene) {
    this.scene = scene;
    this.scene.add(this.mesh);
  }

  /**
   * Called on each frame tick.
   */
  update(delta, time) {
    // Override in subclasses
  }

  /**
   * Triggered when a pilot approaches within interactionRadius and activates it.
   */
  onInteract(playerSystem) {
    console.log(`[WorldObject] Interacted with ${this.name} (${this.id})`);
  }

  /**
   * Clean up resources when object is removed.
   */
  dispose() {
    if (this.scene && this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }
}

/**
 * WorldSystem coordinates all modular WorldObjects in the universe.
 * Allows adding new celestial bodies, portals, and interactive nodes
 * without modifying the core game loop.
 */
export class WorldSystem {
  constructor(scene) {
    this.scene = scene;
    this.objects = new Map();
  }

  register(worldObject) {
    worldObject.init(this.scene);
    this.objects.set(worldObject.id, worldObject);
    console.log(`[WorldSystem] Registered object: ${worldObject.name} (${worldObject.id})`);
    return worldObject;
  }

  unregister(id) {
    const obj = this.objects.get(id);
    if (obj) {
      obj.dispose();
      this.objects.delete(id);
    }
  }

  update(delta, time, playerPosition, playerSystem, audioSystem, overlay) {
    this.objects.forEach((obj) => {
      obj.update(delta, time, playerPosition, playerSystem, audioSystem, overlay);
    });
  }

  checkInteractions(playerPosition, playerSystem) {
    this.objects.forEach((obj) => {
      if (!obj.isInteractive) return;
      const dist = playerPosition.distanceTo(obj.mesh.position);
      if (dist <= obj.interactionRadius) {
        obj.onInteract(playerSystem);
      }
    });
  }
}

/**
 * Example Celestial Planet / Beacon extending WorldObject.
 * Shows how a developer can add a new planet in under an hour.
 */
export class PlanetBeacon extends WorldObject {
  constructor(id, position = new THREE.Vector3(0, -80, -200), radius = 35) {
    super(id, "Nexus Planetoid");
    this.radius = radius;
    this.targetPos = position;
    this.buildGeometry();
  }

  buildGeometry() {
    this.mesh.position.copy(this.targetPos);

    // Planet body
    const planetGeo = new THREE.SphereGeometry(this.radius, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x1a2b4c,
      roughness: 0.8,
      metalness: 0.2,
      emissive: 0x051226,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    this.mesh.add(planetMesh);

    // Glowing atmospheric rim
    const atmoGeo = new THREE.SphereGeometry(this.radius * 1.05, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    this.mesh.add(atmoMesh);

    // Orbital ring
    const ringGeo = new THREE.RingGeometry(this.radius * 1.3, this.radius * 1.8, 48);
    ringGeo.rotateX(Math.PI / 2.5);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9d00ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.mesh.add(ringMesh);
  }

  update(delta, time) {
    this.mesh.rotation.y += delta * 0.05;
  }
}

/**
 * HyperlaneGate — Massive Sci-Fi Jump Gate for Interstellar Travel.
 * Allows pilots to warp between federated Solar Systems with zero permissions.
 */
export class HyperlaneGate extends WorldObject {
  constructor(
    id = "hyperlane_gate_vega",
    position = new THREE.Vector3(0, 15, -150),
    destinationName = "VEGA OUTPOST",
    destinationUrl = "/?system=vega",
    distanceLy = 14.2
  ) {
    super(id, "Hyperlane Gateway");
    this.targetPos = position;
    this.destinationName = destinationName.toUpperCase();
    this.destinationUrl = destinationUrl;
    this.distanceLy = distanceLy;
    this.interactionRadius = 36.0;
    this.isInteractive = true;
    this.isJumping = false;

    this.particles = [];
    this.innerRing = null;
    this.vortexMesh = null;
    this.coreMesh = null;
    this.nametagSprite = null;

    this.buildGeometry();
  }

  buildGeometry() {
    this.mesh.position.copy(this.targetPos);

    const ringRadius = 18;
    const ringTube = 1.35;

    // 1. Heavy Titanium Outer Gate Ring
    const ringGeo = new THREE.TorusGeometry(ringRadius, ringTube, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.92,
      roughness: 0.22,
    });
    const mainRing = new THREE.Mesh(ringGeo, ringMat);
    this.mesh.add(mainRing);

    // 2. Six Symmetrical Conduit Pylons with Power Crystals
    const pylonGeo = new THREE.BoxGeometry(2.4, 6.5, 3.2);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.3,
    });
    const crystalMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const pylonGroup = new THREE.Group();
      pylonGroup.rotation.z = angle;

      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.y = ringRadius;
      pylonGroup.add(pylon);

      // Glowing power emitter crystal
      const crystalGeo = new THREE.CylinderGeometry(0.5, 0.7, 4.0, 8);
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.set(0, ringRadius, 1.2);
      pylonGroup.add(crystal);

      this.mesh.add(pylonGroup);
    }

    // 3. Counter-Rotating Inner Field Ring
    const innerRingGeo = new THREE.TorusGeometry(ringRadius - 3.2, 0.45, 12, 48);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.9,
    });
    this.innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    this.mesh.add(this.innerRing);

    // 4. Swirling Event Horizon Vortex (Center Portal)
    const vortexGeo = new THREE.CircleGeometry(ringRadius - 3.4, 48);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
    this.mesh.add(this.vortexMesh);

    // Inner Deep Purple Singularity Core
    const coreGeo = new THREE.CircleGeometry(ringRadius - 7.5, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x9d00ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.mesh.add(this.coreMesh);

    // 5. Inward-Spiraling Plasma Particles
    const particleCount = 36;
    const particleGeo = new THREE.SphereGeometry(0.22, 6, 6);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < particleCount; i++) {
      const p = new THREE.Mesh(particleGeo, particleMat);
      const orbitAngle = (i / particleCount) * Math.PI * 2;
      const radiusDist = 4.0 + Math.random() * (ringRadius - 5.0);
      p.userData = {
        angle: orbitAngle,
        radius: radiusDist,
        speed: 0.8 + Math.random() * 0.8,
        zOffset: (Math.random() - 0.5) * 6.0,
      };
      this.mesh.add(p);
      this.particles.push(p);
    }

    // 6. Holographic Destination Signage
    this.updateNametag();
  }

  updateNametag() {
    if (this.nametagSprite) {
      this.mesh.remove(this.nametagSprite);
      this.nametagSprite.material.map?.dispose();
      this.nametagSprite.material.dispose();
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    // Background HUD pill
    ctx.fillStyle = "rgba(10, 14, 26, 0.88)";
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(30, 20, 964, 216, 28);
    ctx.fill();
    ctx.stroke();

    // Header text
    ctx.font = "bold 50px 'Orbitron', monospace, sans-serif";
    ctx.fillStyle = "#00f0ff";
    ctx.textAlign = "center";
    ctx.fillText(`⚡ HYPERLANE GATE // ${this.destinationName}`, 512, 85);

    // Subtitle text
    ctx.font = "bold 32px 'JetBrains Mono', monospace, sans-serif";
    ctx.fillStyle = "#ffd700";
    ctx.fillText(`DESTINATION: ${this.distanceLy} LY  |  STATUS: ACTIVE`, 512, 140);

    ctx.font = "26px 'JetBrains Mono', monospace, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`FLY INTO VORTEX OR PRESS [J] TO ENGAGE HYPERDRIVE`, 512, 192);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    this.nametagSprite = new THREE.Sprite(spriteMat);
    this.nametagSprite.position.set(0, 24.5, 0);
    this.nametagSprite.scale.set(38, 9.5, 1);
    this.mesh.add(this.nametagSprite);
  }

  setDestination(name, url, distanceLy = 12.0) {
    this.destinationName = name.toUpperCase();
    this.destinationUrl = url;
    this.distanceLy = distanceLy;
    this.updateNametag();
  }

  isNearGate(playerPos) {
    if (!playerPos) return false;
    return playerPos.distanceTo(this.mesh.position) <= this.interactionRadius;
  }

  engageJump(playerSystem, audioSystem, overlay) {
    if (this.isJumping) return;
    this.isJumping = true;

    if (audioSystem) {
      audioSystem.playWarpSound();
    }

    const banner = document.getElementById("jumpgate-proximity-banner");
    if (banner) {
      banner.innerHTML = `<span style="color:#00f0ff;font-weight:700;">🚀 HYPERDRIVE ENGAGED // WARPING TO ${this.destinationName}...</span>`;
      banner.style.display = "block";
    }

    const warpOverlay = document.getElementById("warp-tunnel-overlay");
    if (warpOverlay) {
      warpOverlay.classList.remove("active");
      void warpOverlay.offsetWidth;
      warpOverlay.classList.add("active");
    }

    if (overlay) {
      overlay.addLogItem(`🚀 [HYPERDRIVE ENGAGED] Warping to Solar System [${this.destinationName}]...`);
    }

    if (playerSystem) {
      const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(playerSystem.quaternion);
      playerSystem.velocity.addScaledVector(forwardDir, 160.0);
    }

    // Carry over pilot callsign, avatar, and color across jump
    const currentName = playerSystem?.localName || localStorage.getItem("pilot_callsign") || "Pilot";
    const currentAvatar = playerSystem?.characterType || "wizard";
    const currentColor = playerSystem?.characterColor ? `#${playerSystem.characterColor.toString(16).padStart(6, "0")}` : "#9d00ff";

    let destUrl = this.destinationUrl;
    const urlObj = new URL(destUrl, window.location.origin);
    urlObj.searchParams.set("pilot", currentName);
    urlObj.searchParams.set("avatar", currentAvatar);
    urlObj.searchParams.set("color", currentColor);

    setTimeout(() => {
      window.location.href = urlObj.toString();
    }, 1500);
  }

  update(delta, time, playerPosition, playerSystem, audioSystem, overlay) {
    // 1. Rotate the inner vortex ring and singularity
    if (this.innerRing) {
      this.innerRing.rotation.z -= delta * 0.75;
    }
    if (this.vortexMesh) {
      this.vortexMesh.rotation.z += delta * 0.35;
      const pulse = 0.55 + Math.sin(time * 3.5) * 0.15;
      this.vortexMesh.material.opacity = pulse;
    }
    if (this.coreMesh) {
      this.coreMesh.rotation.z -= delta * 0.5;
      this.coreMesh.material.opacity = 0.65 + Math.cos(time * 4.0) * 0.2;
    }

    // 2. Animate plasma particle swirl into the singularity
    const ringRadius = 18;
    this.particles.forEach((p) => {
      p.userData.radius -= delta * p.userData.speed * 4.5;
      p.userData.angle += delta * p.userData.speed * 1.4;
      if (p.userData.radius <= 1.5) {
        p.userData.radius = ringRadius - 1.0;
      }
      p.position.set(
        Math.cos(p.userData.angle) * p.userData.radius,
        Math.sin(p.userData.angle) * p.userData.radius,
        p.userData.zOffset + Math.sin(time * 2.0 + p.userData.angle) * 1.2
      );
    });

    // 3. Proximity detection with local player ship
    if (!playerPosition || this.isJumping) return;

    const dist = playerPosition.distanceTo(this.mesh.position);
    const gateNotice = document.getElementById("jumpgate-proximity-banner");

    if (dist <= this.interactionRadius) {
      if (gateNotice && !this.isJumping) {
        gateNotice.style.display = "block";
        gateNotice.innerHTML = `⚡ HYPERSPACE VECTOR LOCKED: <strong>${this.destinationName}</strong> [${this.distanceLy} LY]<br/><span style="color:#ffd700;font-size:11px;">PRESS [J] OR FLY INTO VORTEX TO ENGAGE HYPERDRIVE</span>`;
      }

      // If player flies directly into the vortex event horizon (within 13 units):
      if (dist <= 13.0) {
        this.engageJump(playerSystem, audioSystem, overlay);
      }
    } else {
      if (gateNotice && gateNotice.style.display !== "none" && !this.isJumping) {
        gateNotice.style.display = "none";
      }
    }
  }
}
