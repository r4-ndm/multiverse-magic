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
    this.shootCooldown = 500; // 500ms

    // Active visual effects pools
    this.activeBeams = [];
    this.activeSparks = [];
    this.activeFlashes = [];
  }

  init(networkSystem, playerSystem, audioSystem) {
    this.networkSystem = networkSystem;
    this.playerSystem = playerSystem;
    this.audioSystem = audioSystem;

    // Listen for left-click to shoot
    window.addEventListener("mousedown", (e) => {
      // Left click
      if (e.button === 0 && this.playerSystem.isPointerLocked) {
        this.shoot();
      }
    });
  }

  shoot() {
    const now = performance.now();
    if (now - this.lastShootTime < this.shootCooldown) return;
    this.lastShootTime = now;

    // 1. Raycast from camera center (crosshair at 0, 0)
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 250.0;

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

    // Calculate origin (ship nose)
    const shipPos = this.playerSystem.position.clone();
    const shipQuat = this.playerSystem.quaternion.clone();
    const noseOffset = new THREE.Vector3(0, 0.2, -2.5).applyQuaternion(shipQuat);
    const laserOrigin = shipPos.add(noseOffset);

    let hitPoint = null;
    let hitTargetId = null;

    if (intersects.length > 0) {
      const hit = intersects[0];
      hitPoint = hit.point;
      hitTargetId = hit.object.userData.targetSessionId;
    } else {
      // If no hit, beam travels out into space
      const shootDir = new THREE.Vector3();
      this.raycaster.ray.direction.clone();
      hitPoint = laserOrigin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(200));
    }

    // Render local beam and muzzle flash
    this.createLaserBeam(laserOrigin, hitPoint, 0x00f0ff);
    this.createMuzzleFlash(laserOrigin, 0x00f0ff);

    // Play local pew sound
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
    // If it was the local player, we already rendered the local prediction
    if (data.shooterId === this.networkSystem?.sessionId) return;

    const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
    let destination;

    if (data.hitPoint) {
      destination = new THREE.Vector3(data.hitPoint.x, data.hitPoint.y, data.hitPoint.z);
      this.createHitSpark(destination, 0xff0055);
    } else {
      const dir = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
      destination = origin.clone().add(dir.multiplyScalar(200));
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

  createLaserBeam(start, end, colorHex = 0x00f0ff) {
    const points = [start, end];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
      color: colorHex,
      linewidth: 3,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    this.activeBeams.push({
      line,
      material,
      life: 0.15, // 150ms lifespan
      maxLife: 0.15,
    });
  }

  createMuzzleFlash(position, colorHex) {
    const flashGeo = new THREE.SphereGeometry(0.55, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.copy(position);
    this.scene.add(flashMesh);

    this.activeFlashes.push({
      mesh: flashMesh,
      material: flashMat,
      life: 0.08,
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
      size: 1.2,
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
    // 1. Update laser beams
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const beam = this.activeBeams[i];
      beam.life -= delta;
      if (beam.life <= 0) {
        this.scene.remove(beam.line);
        beam.line.geometry.dispose();
        beam.material.dispose();
        this.activeBeams.splice(i, 1);
      } else {
        beam.material.opacity = beam.life / beam.maxLife;
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
