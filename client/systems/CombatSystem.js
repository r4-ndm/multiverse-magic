import * as THREE from "three";
import { BLOCK_SIZE, snapBlockPosition, blockCellKey, faceFromNormal, graffitiMeshes } from "./BuildBlock.js";

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
    this.spaceHeld = false;
    this.weaponMode = "laser"; // "laser" | "block" | "link"
    this.lastPlaceTime = 0;

    // Active visual effects pools
    this.activeBeams = [];
    this.activeSparks = [];
    this.activeFlashes = [];

    this._listenersBound = false;
  }

  init(networkSystem, playerSystem, audioSystem, worldSystem = null) {
    this.networkSystem = networkSystem;
    this.playerSystem = playerSystem;
    this.audioSystem = audioSystem;
    this.worldSystem = worldSystem;

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
        target.closest("#entry-overlay") ||
        target.closest("#graffiti-links") ||
        target.closest("#link-gun-modal") ||
        target.closest("#meeting-modal") ||
        target.closest("#jumpgate-proximity-banner a")
      ) {
        return;
      }

      // Left click
      if (e.button === 0) {
        if (this.weaponMode !== "link" && this.weaponMode !== "meet" && this.openGraffitiAtCrosshair()) {
          return;
        }
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

    // KeyF follows the armed gun. Space always fires the laser, even through a tag.
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "KeyF" && !e.repeat) {
        this.shoot();
      }
      if (e.code === "Space") {
        e.preventDefault();
        this.spaceHeld = true;
        this.fireLaser();
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") this.spaceHeld = false;
    });
    window.addEventListener("blur", () => {
      this.spaceHeld = false;
    });
  }

  setWeaponMode(mode) {
    if (mode === "block" || mode === "link" || mode === "meet") this.weaponMode = mode;
    else this.weaponMode = "laser";
  }

  openGraffitiAtCrosshair() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 80;
    const stickers = graffitiMeshes(this.worldSystem?.objects);
    const hits = stickers.length ? this.raycaster.intersectObjects(stickers, false) : [];
    const url = hits[0]?.object.userData.graffitiUrl;
    if (!url) return false;
    const opener = document.createElement("a");
    opener.href = url;
    opener.target = "_blank";
    opener.rel = "noopener noreferrer";
    document.body.appendChild(opener);
    opener.click();
    opener.remove();
    return true;
  }

  shoot() {
    if (!this.playerSystem) return;
    if (this.weaponMode === "block") {
      this.placeBlock();
      return;
    }
    if (this.weaponMode === "link") {
      this.paintLink();
      return;
    }
    if (this.weaponMode === "meet") {
      this.paintMeeting();
      return;
    }

    this.fireLaser();
  }

  fireLaser() {
    if (!this.playerSystem) return;
    const now = performance.now();
    if (now - this.lastShootTime < this.shootCooldown) return;
    this.lastShootTime = now;

    // 1. Raycast from camera center (crosshair at 0, 0)
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 480.0;

    // Gather candidate meshes from remote players and destructible planets
    const targets = [];
    this.playerSystem.remotePlayers.forEach((remote, sessionId) => {
      remote.mesh.traverse((child) => {
        if (child.isMesh) {
          child.userData.targetSessionId = sessionId;
          targets.push(child);
        }
      });
    });
    this.worldSystem?.objects.forEach((obj) => {
      if (!obj.isDestructible || !obj.mesh) return;
      obj.mesh.traverse((child) => {
        if (child.isMesh) {
          child.userData.planetId = obj.id;
          targets.push(child);
        }
      });
    });

    const intersects = this.raycaster.intersectObjects(targets, false);

    // Beam starts off to the side and travels into the crosshair hit.
    const laserOrigin = this.laserOrigin();

    let hitPoint = null;
    let hitTargetId = null;

    const boxHit = this.closestContainerHit();

    if (intersects.length > 0) {
      const hit = intersects[0];
      hitPoint = hit.point;
      hitTargetId = hit.object.userData.planetId || hit.object.userData.targetSessionId;
    } else {
      // Also check bounding volumes for smooth hit registration
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
      this.worldSystem?.objects.forEach((obj) => {
        if (!obj.isDestructible || !obj.mesh) return;
        const center = obj.mesh.position;
        const hitRadius = Math.max(12, obj.radius || 20);
        if (ray.distanceToPoint(center) < hitRadius) {
          const distFromCam = this.camera.position.distanceTo(center);
          if (distFromCam < closestDist && distFromCam < 300 + hitRadius) {
            closestDist = distFromCam;
            hitTargetId = obj.id;
            hitPoint = center.clone();
          }
        }
      });
    }

    if (boxHit) {
      const currentDist = hitPoint ? this.camera.position.distanceTo(hitPoint) : Infinity;
      if (boxHit.dist <= currentDist + 0.05) {
        hitTargetId = boxHit.id;
        hitPoint = boxHit.point;
      }
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

  closestContainerHit() {
    const ray = this.raycaster.ray;
    const size = new THREE.Vector3(BLOCK_SIZE.x, BLOCK_SIZE.y, BLOCK_SIZE.z);
    const box = new THREE.Box3();
    const point = new THREE.Vector3();
    let best = null;
    this.worldSystem?.objects.forEach((obj) => {
      if (!obj.isBuildBlock || !obj.mesh) return;
      box.setFromCenterAndSize(obj.mesh.position, size);
      if (!ray.intersectBox(box, point)) return;
      const dist = ray.origin.distanceTo(point);
      if (dist > this.raycaster.far) return;
      if (!best || dist < best.dist) best = { id: obj.id, point: point.clone(), dist };
    });
    return best;
  }

  placeBlock() {
    const now = performance.now();
    if (now - this.lastPlaceTime < 400) return;
    this.lastPlaceTime = now;

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 80;

    const targets = [];
    this.worldSystem?.objects.forEach((obj) => {
      if (!obj.isDestructible || !obj.mesh) return;
      obj.mesh.traverse((child) => {
        if (child.isMesh) targets.push(child);
      });
    });

    const hits = targets.length ? this.raycaster.intersectObjects(targets, false) : [];
    const shot = this.laserOrigin();
    let placeAt = null;

    if (hits.length > 0 && hits[0].face) {
      const hit = hits[0];
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
      const step = this.gridStep(normal);
      let candidate = snapBlockPosition(
        hit.point.x + step.x * 0.55,
        hit.point.y + step.y * 0.55,
        hit.point.z + step.z * 0.55
      );
      for (let i = 0; i < 4; i++) {
        if (!this.blockCellOccupied(candidate)) {
          placeAt = candidate;
          break;
        }
        candidate = snapBlockPosition(
          candidate.x + step.x,
          candidate.y + step.y,
          candidate.z + step.z
        );
      }
    } else {
      const along = this.raycaster.ray.origin.clone().add(
        this.raycaster.ray.direction.clone().multiplyScalar(36)
      );
      placeAt = snapBlockPosition(along.x, along.y, along.z);
      if (this.blockCellOccupied(placeAt)) placeAt = null;
    }

    const end = placeAt
      ? new THREE.Vector3(placeAt.x, placeAt.y, placeAt.z)
      : this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(36));

    this.createLaserBeam(shot, end, 0xffd700);
    this.createMuzzleFlash(shot, 0xffd700);
    this.audioSystem?.playPewSound();

    if (!placeAt || !this.networkSystem) return;
    const color = "#" + (this.playerSystem.characterColor >>> 0).toString(16).padStart(6, "0").slice(-6);
    this.networkSystem.sendPlaceBlock(placeAt.x, placeAt.y, placeAt.z, color);
  }

  paintLink() {
    const now = performance.now();
    if (now - this.lastPlaceTime < 400) return;
    this.lastPlaceTime = now;

    const url = window.multiverseApp?.overlay?.linkInkUrl;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 80;

    const targets = [];
    this.worldSystem?.objects.forEach((obj) => {
      if (!obj.isBuildBlock || !obj.mesh) return;
      obj.mesh.traverse((child) => {
        if (child.isMesh) targets.push(child);
      });
    });
    const hits = targets.length ? this.raycaster.intersectObjects(targets, false) : [];
    const shot = this.laserOrigin();
    const hit = hits[0];
    const end = hit?.point
      ? hit.point.clone()
      : this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(36));

    this.createLaserBeam(shot, end, 0xff2bd6);
    this.createMuzzleFlash(shot, 0xff2bd6);
    this.audioSystem?.playPewSound();

    if (!url) {
      window.multiverseApp?.overlay?.openLinkGunModal();
      window.multiverseApp?.overlay?.addLogItem("🔗 Load a link before spraying a tag.");
      return;
    }
    if (!hit?.face || !this.networkSystem) {
      window.multiverseApp?.overlay?.addLogItem("🔗 Aim at a container to spray a link.");
      return;
    }

    const blockId = hit.object.userData.blockId || hit.object.userData.planetId;
    const face = hit.object.userData.graffitiFace || faceFromNormal(
      hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
    );
    this.networkSystem.sendPaintLink(blockId, face, url);
  }

  paintMeeting() {
    const now = performance.now();
    if (now - this.lastPlaceTime < 400) return;
    this.lastPlaceTime = now;

    const pending = window.multiverseApp?.overlay?.pendingMeeting;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 80;

    const targets = [];
    this.worldSystem?.objects.forEach((obj) => {
      if (!obj.isBuildBlock || !obj.mesh) return;
      obj.mesh.traverse((child) => {
        if (child.isMesh) targets.push(child);
      });
    });
    const hits = targets.length ? this.raycaster.intersectObjects(targets, false) : [];
    const shot = this.laserOrigin();
    const hit = hits[0];
    const end = hit?.point
      ? hit.point.clone()
      : this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(36));

    this.createLaserBeam(shot, end, 0xffd700);
    this.createMuzzleFlash(shot, 0xffd700);
    this.audioSystem?.playPewSound();

    if (!pending?.startsAt) {
      window.multiverseApp?.overlay?.openMeetingModal();
      window.multiverseApp?.overlay?.addLogItem("📅 Set a meeting time, then shoot a container.");
      return;
    }
    if (!hit?.face || !this.networkSystem) {
      window.multiverseApp?.overlay?.addLogItem("📅 Aim at a container to place the meeting.");
      return;
    }

    const blockId = hit.object.userData.blockId || hit.object.userData.planetId;
    const face = hit.object.userData.graffitiFace || faceFromNormal(
      hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
    );
    this.networkSystem.sendScheduleMeeting(blockId, face, pending.title, pending.startsAt);
  }

  laserOrigin() {
    const offset = new THREE.Vector3(0.35, -0.22, -0.55).applyQuaternion(this.camera.quaternion);
    return this.camera.position.clone().add(offset);
  }

  gridStep(normal) {
    const ax = Math.abs(normal.x);
    const ay = Math.abs(normal.y);
    const az = Math.abs(normal.z);
    if (ax >= ay && ax >= az) return new THREE.Vector3(Math.sign(normal.x || 1) * BLOCK_SIZE.x, 0, 0);
    if (ay >= az) return new THREE.Vector3(0, Math.sign(normal.y || 1) * BLOCK_SIZE.y, 0);
    return new THREE.Vector3(0, 0, Math.sign(normal.z || 1) * BLOCK_SIZE.z);
  }

  blockCellOccupied(pos) {
    const key = blockCellKey(pos.x, pos.y, pos.z);
    let taken = false;
    this.worldSystem?.objects.forEach((obj) => {
      if (obj.isBuildBlock && obj.cellKey === key) taken = true;
    });
    return taken;
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
    if (this.spaceHeld) this.fireLaser();

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
