import * as THREE from "three";

/**
 * CombatSystem handles laser raycasting, target detection, laser beam rendering,
 * hit sparks, muzzle flashes, and screen damage effects.
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
    this.shootCooldown = 400; // 400ms cooldown

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

    // Listen for left-click to shoot
    window.addEventListener("mousedown", (e) => {
      // Ignore clicks on UI inputs, buttons, and modals
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
        // Auto-request pointer lock if not locked
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

    // Keyboard trigger: KeyF to fire laser
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
    this.raycaster.far = 280.0;

    // Gather candidate meshes from remote players
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

    // Calculate weapon origin: Thor's Hammer / weapon arm offset so laser visibly emerges from weapon
    const shipPos = this.playerSystem.position.clone();
    const shipQuat = this.playerSystem.quaternion.clone();
    const weaponOffset = new THREE.Vector3(0.65, 0.95, -1.0).applyQuaternion(shipQuat);
    const laserOrigin = shipPos.clone().add(weaponOffset);

    let hitPoint = null;
    let hitTargetId = null;

    if (intersects.length > 0) {
      const hit = intersects[0];
      hitPoint = hit.point;
      hitTargetId = hit.object.userData.targetSessionId;
    } else {
      // Also check bounding sphere for smooth hit registration
      const ray = this.raycaster.ray;
      let closestDist = Infinity;
      this.playerSystem.remotePlayers.forEach((remote, sessionId) => {
        const center = remote.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const distToRay = ray.distanceToPoint(center);
        if (distToRay < 2.5) {
          const distFromCam = this.camera.position.distanceTo(center);
          if (distFromCam < closestDist && distFromCam < 280) {
            closestDist = distFromCam;
            hitTargetId = sessionId;
            hitPoint = center.clone();
          }
        }
      });
    }

    if (!hitPoint) {
      // If no hit, laser beam travels straight out toward crosshair aim point in space
      hitPoint = this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(220));
    }

    // Render local laser beam (bright cyan) and muzzle flash
    this.createLaserBeam(laserOrigin, hitPoint, 0x00f0ff);
    this.createMuzzleFlash(laserOrigin, 0x00f0ff);

    if (hitTargetId) {
      this.createHitSpark(hitPoint, 0xff0055);
    }

    // Play classic local pew sound
    if (this.audioSystem) {
      this.audioSystem.playPewSound();
    }

    // Broadcast to server
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

    // Render peer laser beam (neon magenta/pink)
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
      // Local player sustained damage!
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
   * Creates an intense, volumetric 3D glowing laser beam directly between start and end.
   */
  createLaserBeam(start, end, colorHex = 0x00f0ff) {
    const dist = start.distanceTo(end);
    if (dist < 0.05) return;

    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    // 1. Outer volumetric neon laser beam cylinder (glow sheath)
    const outerGeo = new THREE.CylinderGeometry(0.14, 0.14, dist, 8, 1, true);
    const outerMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.position.copy(midPoint);
    outerMesh.quaternion.copy(quat);
    this.scene.add(outerMesh);

    // 2. Inner intense white-hot laser core cylinder
    const coreGeo = new THREE.CylinderGeometry(0.05, 0.05, dist, 6, 1, true);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.copy(midPoint);
    coreMesh.quaternion.copy(quat);
    this.scene.add(coreMesh);

    // 3. Crisp center line for sharp silhouette at distance
    const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    this.scene.add(line);

    this.activeBeams.push({
      outerMesh,
      coreMesh,
      line,
      outerMat,
      coreMat,
      lineMat,
      life: 0.28, // 280ms duration for high-speed clarity
      maxLife: 0.28,
    });
  }

  createMuzzleFlash(position, colorHex) {
    const flashGeo = new THREE.SphereGeometry(0.65, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.copy(position);

    // Inner bright core
    const coreGeo = new THREE.SphereGeometry(0.32, 8, 8);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    flashMesh.add(coreMesh);

    this.scene.add(flashMesh);

    this.activeFlashes.push({
      mesh: flashMesh,
      material: flashMat,
      coreMat,
      life: 0.12,
      maxLife: 0.12,
    });
  }

  createHitSpark(position, colorHex = 0xff0055) {
    const sparkCount = 14;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(sparkCount * 3);
    const velocities = [];

    for (let i = 0; i < sparkCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
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
      life: 0.3,
      maxLife: 0.3,
    });
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
    // 1. Update volumetric laser beams
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const beam = this.activeBeams[i];
      beam.life -= delta;
      if (beam.life <= 0) {
        if (beam.outerMesh) {
          this.scene.remove(beam.outerMesh);
          beam.outerMesh.geometry.dispose();
          beam.outerMat?.dispose();
        }
        if (beam.coreMesh) {
          this.scene.remove(beam.coreMesh);
          beam.coreMesh.geometry.dispose();
          beam.coreMat?.dispose();
        }
        if (beam.line) {
          this.scene.remove(beam.line);
          beam.line.geometry.dispose();
          beam.lineMat?.dispose();
        }
        this.activeBeams.splice(i, 1);
      } else {
        const opacity = beam.life / beam.maxLife;
        if (beam.outerMat) beam.outerMat.opacity = opacity * 0.9;
        if (beam.coreMat) beam.coreMat.opacity = opacity;
        if (beam.lineMat) beam.lineMat.opacity = opacity;
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
        flash.coreMat?.dispose();
        this.activeFlashes.splice(i, 1);
      } else {
        flash.mesh.scale.multiplyScalar(1.15);
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
