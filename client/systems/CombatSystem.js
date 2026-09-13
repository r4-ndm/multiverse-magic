import * as THREE from "three";

/**
 * CombatSystem handles laser & arcane raycasting, hit detection, volumetric
 * 3D beam rendering, muzzle flashes, hit sparks, screen damage effects, and audio triggers.
 */
export class CombatSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.networkSystem = null;
    this.playerSystem = null;
    this.audioSystem = null;

    this.lastShootTime = 0;
    this.shootCooldown = 350; // Snappy 350ms cooldown

    // Active visual effects pools
    this.activeBeams = [];
    this.activeSparks = [];
    this.activeFlashes = [];

    this._listenersBound = false;
  }

  init(networkSystem, playerSystem, audioSystem) {
    this.networkSystem = networkSystem;
    this.playerSystem = playerSystem;
    this.audioSystem = audioSystem;

    if (this._listenersBound) return;
    this._listenersBound = true;

    // 1. Listen for left-click to shoot
    window.addEventListener("mousedown", (e) => {
      // Ignore clicks on UI elements (inputs, buttons, modals)
      const target = e.target;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "BUTTON" ||
        target.closest("#morph-modal") ||
        target.closest("#entry-overlay")
      ) {
        return;
      }

      // Left click
      if (e.button === 0) {
        // Auto-request pointer lock if not locked, without blocking the shot
        if (
          this.playerSystem &&
          !this.playerSystem.isPointerLocked &&
          document.pointerLockElement !== this.playerSystem.domElement
        ) {
          this.playerSystem.domElement?.requestPointerLock();
        }
        this.shoot();
      }
    });

    // 2. Keyboard trigger: KeyF to fire
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "KeyF" && !e.repeat) {
        this.shoot();
      }
    });
  }

  shoot() {
    if (!this.playerSystem) return;

    const now = performance.now();
    if (now - this.lastShootTime < this.shootCooldown) return;
    this.lastShootTime = now;

    // 1. Raycast from camera center (crosshair at 0, 0)
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 300.0;

    // 2. Target detection: gather remote players
    const targets = [];
    this.playerSystem.remotePlayers.forEach((remote, sessionId) => {
      remote.mesh.traverse((child) => {
        if (child.isMesh) {
          child.userData.targetSessionId = sessionId;
          targets.push(child);
        }
      });
    });

    const intersects = this.raycaster.intersectObjects(targets, false);

    let hitPoint = null;
    let hitTargetId = null;

    if (intersects.length > 0) {
      hitPoint = intersects[0].point;
      hitTargetId = intersects[0].object.userData.targetSessionId;
    } else {
      // Generous proximity hitbox for snappy, rewarding combat feel
      const ray = this.raycaster.ray;
      let closestDist = Infinity;

      this.playerSystem.remotePlayers.forEach((remote, sessionId) => {
        const center = remote.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const distToRay = ray.distanceToPoint(center);
        if (distToRay < 2.6) {
          const distFromCam = this.camera.position.distanceTo(center);
          if (distFromCam < closestDist && distFromCam < 300) {
            closestDist = distFromCam;
            hitTargetId = sessionId;
            hitPoint = center.clone();
          }
        }
      });
    }

    // 3. Compute weapon muzzle origin based on active avatar
    const shipPos = this.playerSystem.position.clone();
    const shipQuat = this.playerSystem.quaternion.clone();

    let localOffset;
    if (this.playerSystem.characterType === "wizard") {
      // Emanate directly from Thor's Hammer (held in right hand)
      localOffset = new THREE.Vector3(0.75, 0.95, -0.9);
    } else if (this.playerSystem.characterType === "vessel") {
      // Starship nose cannons
      localOffset = new THREE.Vector3(0, 0.2, -2.5);
    } else {
      // Humanoid avatar blaster hand
      localOffset = new THREE.Vector3(0.35, 1.1, -1.0);
    }

    const muzzleOffset = localOffset.applyQuaternion(shipQuat);
    const laserOrigin = shipPos.add(muzzleOffset);

    // If no hit, beam travels into deep space
    if (!hitPoint) {
      hitPoint = laserOrigin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(220));
    }

    // Determine beam color (Cyan / Lightning Blue by default)
    const beamColor = this.playerSystem.characterColor || 0x00f0ff;

    // 4. Render volumetric 3D energy beam & muzzle flash
    this.createLaserBeam(laserOrigin, hitPoint, beamColor);
    this.createMuzzleFlash(laserOrigin, beamColor);

    // If target was hit, trigger hit spark immediately
    if (hitTargetId) {
      this.createHitSpark(hitPoint, 0xff0055);
    }

    // 5. Tactile crosshair recoil animation
    this.triggerCrosshairRecoil();

    // 6. Play local pew sound
    if (this.audioSystem) {
      this.audioSystem.playPewSound();
    }

    // 7. Broadcast to server
    if (this.networkSystem) {
      this.networkSystem.sendShoot(
        hitTargetId,
        laserOrigin,
        this.raycaster.ray.direction,
        hitPoint
      );
    }
  }

  /**
   * Called when server broadcasts a shot fired by any player.
   */
  handleShotFired(data) {
    if (data.shooterId === this.networkSystem?.sessionId) return;

    const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
    let destination;

    if (data.hitPoint) {
      destination = new THREE.Vector3(data.hitPoint.x, data.hitPoint.y, data.hitPoint.z);
      this.createHitSpark(destination, 0xff0055);
    } else {
      const dir = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
      destination = origin.clone().add(dir.multiplyScalar(220));
    }

    // Render hostile / peer laser beam (neon magenta/pink)
    this.createLaserBeam(origin, destination, 0xff0055);
    this.createMuzzleFlash(origin, 0xff0055);

    // Play audio if within hearing distance
    if (this.audioSystem && this.playerSystem) {
      const dist = this.playerSystem.position.distanceTo(origin);
      if (dist < 120) {
        this.audioSystem.playPewSound();
      }
    }
  }

  /**
   * Called when server broadcasts that a player was hit.
   */
  handlePlayerHit(data) {
    const isLocal = data.targetId === this.networkSystem?.sessionId;

    if (isLocal) {
      // Local player sustained damage
      this.flashDamageVignette();
      if (this.audioSystem) this.audioSystem.playHitSound();

      // Update local health UI
      const healthFill = document.getElementById("health-bar-fill");
      const healthValue = document.getElementById("health-value");
      const vignette = document.getElementById("damage-vignette");

      if (healthFill && healthValue) {
        healthFill.style.width = `${Math.max(0, data.health)}%`;
        healthValue.innerText = `${Math.max(0, data.health)}%`;

        if (data.health < 30) {
          healthFill.classList.add("danger");
          vignette?.classList.add("critical");
        } else {
          healthFill.classList.remove("danger");
          vignette?.classList.remove("critical");
        }
      }
    } else {
      // Remote player hit
      const remote = this.playerSystem?.remotePlayers.get(data.targetId);
      if (remote) {
        this.createHitSpark(remote.mesh.position.clone(), 0x00f0ff);
      }
      if (this.audioSystem && this.playerSystem && remote) {
        const dist = this.playerSystem.position.distanceTo(remote.mesh.position);
        if (dist < 80) this.audioSystem.playHitSound();
      }
    }
  }

  /**
   * Creates a volumetric 3D cylinder laser beam with glowing core and point light.
   */
  createLaserBeam(start, end, colorHex = 0x00f0ff) {
    const distance = start.distanceTo(end);
    if (distance < 0.1) return;

    // 1. Outer energy beam cylinder
    const beamRadius = 0.14;
    const geometry = new THREE.CylinderGeometry(beamRadius, beamRadius, distance, 8, 1, true);
    geometry.translate(0, distance / 2, 0);
    geometry.rotateX(Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const beamMesh = new THREE.Mesh(geometry, material);
    beamMesh.position.copy(start);
    beamMesh.lookAt(end);
    this.scene.add(beamMesh);

    // 2. High-intensity white energy core
    const coreGeo = new THREE.CylinderGeometry(beamRadius * 0.45, beamRadius * 0.45, distance, 6, 1, true);
    coreGeo.translate(0, distance / 2, 0);
    coreGeo.rotateX(Math.PI / 2);

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    beamMesh.add(coreMesh);

    // 3. Dynamic flash light illuminating surrounding space
    const flashLight = new THREE.PointLight(colorHex, 3.5, 35);
    flashLight.position.copy(start);
    this.scene.add(flashLight);

    this.activeBeams.push({
      mesh: beamMesh,
      light: flashLight,
      material,
      coreMat,
      life: 0.26, // 260ms lifespan
      maxLife: 0.26,
    });
  }

  createMuzzleFlash(position, colorHex) {
    const flashGeo = new THREE.SphereGeometry(0.65, 10, 10);
    const flashMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.copy(position);
    this.scene.add(flashMesh);

    this.activeFlashes.push({
      mesh: flashMesh,
      material: flashMat,
      life: 0.12,
      maxLife: 0.12,
    });
  }

  createHitSpark(position, colorHex = 0xff0055) {
    const sparkCount = 16;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(sparkCount * 3);
    const velocities = [];

    for (let i = 0; i < sparkCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18
      );
      velocities.push(vel);
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 1.4,
      color: colorHex,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.activeSparks.push({
      points,
      material,
      velocities,
      positions,
      life: 0.35,
      maxLife: 0.35,
    });
  }

  triggerCrosshairRecoil() {
    const crosshair = document.getElementById("crosshair");
    if (!crosshair) return;
    crosshair.style.transform = "translate(-50%, -50%) scale(1.45)";
    crosshair.style.filter = "brightness(2) drop-shadow(0 0 10px #00f0ff)";
    setTimeout(() => {
      crosshair.style.transform = "translate(-50%, -50%) scale(1)";
      crosshair.style.filter = "none";
    }, 110);
  }

  flashDamageVignette() {
    const vig = document.getElementById("damage-vignette");
    if (!vig) return;
    vig.style.boxShadow = "inset 0 0 160px rgba(255, 0, 85, 0.9)";
    setTimeout(() => {
      const isCritical = (this.playerSystem?.health || 100) < 30;
      if (!isCritical) {
        vig.style.boxShadow = "inset 0 0 120px rgba(255, 0, 85, 0)";
      }
    }, 220);
  }

  update(delta) {
    // 1. Update volumetric laser beams & dynamic lights
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const beam = this.activeBeams[i];
      beam.life -= delta;
      if (beam.life <= 0) {
        this.scene.remove(beam.mesh);
        if (beam.light) this.scene.remove(beam.light);
        beam.mesh.geometry.dispose();
        beam.material.dispose();
        beam.coreMat?.dispose();
        this.activeBeams.splice(i, 1);
      } else {
        const progress = beam.life / beam.maxLife;
        beam.material.opacity = progress * 0.95;
        if (beam.coreMat) beam.coreMat.opacity = progress;
        if (beam.light) beam.light.intensity = progress * 3.5;
      }
    }

    // 2. Update muzzle flashes
    for (let i = this.activeFlashes.length - 1; i >= 0; i--) {
      const flash = this.activeFlashes[i];
      flash.life -= delta;
      if (flash.life <= 0) {
        this.scene.remove(flash.mesh);
        flash.mesh.geometry.dispose();
        flash.material.dispose();
        this.activeFlashes.splice(i, 1);
      } else {
        flash.mesh.scale.multiplyScalar(1.18);
        flash.material.opacity = (flash.life / flash.maxLife) * 0.95;
      }
    }

    // 3. Update hit spark particles
    for (let i = this.activeSparks.length - 1; i >= 0; i--) {
      const spark = this.activeSparks[i];
      spark.life -= delta;
      if (spark.life <= 0) {
        this.scene.remove(spark.points);
        spark.points.geometry.dispose();
        spark.material.dispose();
        this.activeSparks.splice(i, 1);
      } else {
        const count = spark.velocities.length;
        for (let j = 0; j < count; j++) {
          spark.positions[j * 3] += spark.velocities[j].x * delta;
          spark.positions[j * 3 + 1] += spark.velocities[j].y * delta;
          spark.positions[j * 3 + 2] += spark.velocities[j].z * delta;
        }
        spark.points.geometry.attributes.position.needsUpdate = true;
        spark.material.opacity = spark.life / spark.maxLife;
      }
    }
  }
}
