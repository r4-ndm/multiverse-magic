import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * PlayerSystem manages the local player's controls, space flight physics (with inertia),
 * third-person chase camera, avatar loading, and remote player mesh management.
 */
export class PlayerSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // Local player state
    this.localId = null;
    this.mesh = null;
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.quaternion = new THREE.Quaternion();
    this.euler = new THREE.Euler(0, 0, 0, "YXZ");
    this.health = 100;

    // Movement & physics settings
    this.thrustForce = 45.0;
    this.maxSpeed = 65.0;
    this.drag = 0.975; // Space inertia damping
    this.mouseSensitivity = 0.0022;

    // Keyboard state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
      boost: false,
    };

    // Third-person camera offset
    this.cameraOffset = new THREE.Vector3(0, 3.5, 9.0);
    this.cameraLookOffset = new THREE.Vector3(0, 1.2, -8.0);
    this.currentCameraPos = new THREE.Vector3();

    // Remote players registry: sessionId -> { mesh, targetPos, targetRot, healthSprite, trail }
    this.remotePlayers = new Map();

    // Engine particles system
    this.engineParticles = [];
    this.trailGeometry = null;

    // GLTF Model cache
    this.gltfLoader = new GLTFLoader();
    this.shipModelTemplate = null;

    this.isPointerLocked = false;
  }

  init(domElement) {
    this.domElement = domElement;

    // Create local player avatar
    this.mesh = this.createSpaceshipMesh(0x00f0ff);
    this.scene.add(this.mesh);

    // Setup input listeners
    this.setupInputs();

    // Try loading .glb model asynchronously
    this.loadGlbModel();
  }

  loadGlbModel() {
    this.gltfLoader.load(
      "/assets/models/spaceship.glb",
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.8, 0.8, 0.8);
        this.shipModelTemplate = model;

        // Replace local placeholder mesh
        if (this.mesh) {
          const pos = this.mesh.position.clone();
          const quat = this.mesh.quaternion.clone();
          this.scene.remove(this.mesh);

          this.mesh = model.clone();
          this.mesh.position.copy(pos);
          this.mesh.quaternion.copy(quat);
          this.scene.add(this.mesh);
        }
      },
      undefined,
      (err) => {
        // Fallback procedural mesh is already active and works beautifully
        console.log("[PlayerSystem] Using procedural spaceship mesh (standard fallback)");
      }
    );
  }

  /**
   * Generates a sleek, scifi interceptor spacecraft mesh.
   */
  createSpaceshipMesh(accentColor = 0x00f0ff) {
    const shipGroup = new THREE.Group();

    // 1. Fuselage
    const bodyGeo = new THREE.ConeGeometry(0.8, 3.2, 5);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.8,
      roughness: 0.3,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    shipGroup.add(bodyMesh);

    // 2. Cockpit canopy
    const canopyGeo = new THREE.BoxGeometry(0.45, 0.35, 1.2);
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      metalness: 0.2,
    });
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.set(0, 0.35, 0.2);
    shipGroup.add(canopyMesh);

    // 3. Swept Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.8, -1.2);
    wingShape.lineTo(2.5, -1.8);
    wingShape.lineTo(0, -0.8);
    wingShape.closePath();

    const extrudeSettings = { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.rotateX(-Math.PI / 2);

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.85,
      roughness: 0.35,
    });

    // Right Wing
    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0.3, 0, 0.2);
    shipGroup.add(rightWing);

    // Left Wing (mirrored)
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.scale.set(-1, 1, 1);
    leftWing.position.set(-0.3, 0, 0.2);
    shipGroup.add(leftWing);

    // 4. Glowing Thruster Nozzles
    const thrusterGeo = new THREE.CylinderGeometry(0.22, 0.35, 0.6, 12);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const thrusterMesh = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterMesh.position.set(0, 0, 1.6);
    shipGroup.add(thrusterMesh);

    // Thruster point light
    const engineLight = new THREE.PointLight(accentColor, 2.0, 15);
    engineLight.position.set(0, 0, 2.0);
    shipGroup.add(engineLight);

    // Bounding box for raycast collision detection
    const hitBoxGeo = new THREE.BoxGeometry(3.5, 1.6, 4.0);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.name = "hitbox";
    shipGroup.add(hitBox);

    shipGroup.castShadow = true;
    return shipGroup;
  }

  setupInputs() {
    window.addEventListener("keydown", (e) => {
      switch (e.code) {
        case "KeyW": this.keys.forward = true; break;
        case "KeyS": this.keys.backward = true; break;
        case "KeyA": this.keys.left = true; break;
        case "KeyD": this.keys.right = true; break;
        case "Space": this.keys.up = true; break;
        case "KeyC":
        case "ShiftLeft":
        case "ShiftRight": this.keys.down = true; break;
      }
    });

    window.addEventListener("keyup", (e) => {
      switch (e.code) {
        case "KeyW": this.keys.forward = false; break;
        case "KeyS": this.keys.backward = false; break;
        case "KeyA": this.keys.left = false; break;
        case "KeyD": this.keys.right = false; break;
        case "Space": this.keys.up = false; break;
        case "KeyC":
        case "ShiftLeft":
        case "ShiftRight": this.keys.down = false; break;
      }
    });

    // Pointer Lock controls
    this.domElement.addEventListener("click", () => {
      if (!this.isPointerLocked && document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.isPointerLocked = document.pointerLockElement === this.domElement;
      const crosshair = document.getElementById("crosshair");
      if (crosshair) crosshair.style.display = this.isPointerLocked ? "block" : "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isPointerLocked) return;

      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      this.euler.y -= movementX * this.mouseSensitivity;
      this.euler.x -= movementY * this.mouseSensitivity;

      // Clamp vertical pitch to prevent gimbal flip
      this.euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.euler.x));

      this.quaternion.setFromEuler(this.euler);
    });
  }

  /**
   * Updates local ship movement, inertia, and third-person camera.
   */
  update(delta) {
    if (!this.mesh) return;

    // Calculate acceleration direction in local ship space
    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.z -= 1;
    if (this.keys.backward) moveDir.z += 1;
    if (this.keys.left) moveDir.x -= 1;
    if (this.keys.right) moveDir.x += 1;
    if (this.keys.up) moveDir.y += 1;
    if (this.keys.down) moveDir.y -= 1;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      // Rotate input direction by current ship orientation
      moveDir.applyQuaternion(this.quaternion);

      // Apply thrust acceleration
      this.velocity.addScaledVector(moveDir, this.thrustForce * delta);
    }

    // Clamp to max speed
    if (this.velocity.length() > this.maxSpeed) {
      this.velocity.setLength(this.maxSpeed);
    }

    // Apply space friction/inertia damping
    this.velocity.multiplyScalar(Math.pow(this.drag, delta * 60));

    // Update position
    this.position.addScaledVector(this.velocity, delta);

    // Apply orientation and position to mesh
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.copy(this.quaternion);

    // Smoothly update third-person camera
    this.updateCamera(delta);

    // Update remote players interpolation
    this.updateRemotePlayers(delta);
  }

  updateCamera(delta) {
    // Ideal camera position behind and above the ship
    const targetCamOffset = this.cameraOffset.clone().applyQuaternion(this.quaternion);
    const targetCamPos = this.position.clone().add(targetCamOffset);

    // Lerp camera position for cinematic trailing feel
    this.camera.position.lerp(targetCamPos, 0.14);

    // Camera look-at target slightly in front of the ship
    const lookTarget = this.position.clone().add(
      this.cameraLookOffset.clone().applyQuaternion(this.quaternion)
    );
    this.camera.lookAt(lookTarget);
  }

  /**
   * Adds or updates a remote player avatar in the space.
   */
  addOrUpdateRemotePlayer(sessionId, data) {
    let remote = this.remotePlayers.get(sessionId);

    if (!remote) {
      // Create remote avatar
      const color = 0xff0055; // Distinct hostile / peer color
      const mesh = this.createSpaceshipMesh(color);
      mesh.userData.playerId = sessionId;

      // Create health bar sprite billboard
      const healthSprite = this.createHealthSprite(data.health || 100);
      healthSprite.position.set(0, 2.0, 0);
      mesh.add(healthSprite);

      this.scene.add(mesh);

      remote = {
        mesh,
        targetPos: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
        targetRot: data.rotation || 0,
        targetPitch: data.pitch || 0,
        health: data.health || 100,
        healthSprite,
      };

      mesh.position.copy(remote.targetPos);
      this.remotePlayers.set(sessionId, remote);
    } else {
      // Update target positions for smooth interpolation
      if (typeof data.x === "number") remote.targetPos.x = data.x;
      if (typeof data.y === "number") remote.targetPos.y = data.y;
      if (typeof data.z === "number") remote.targetPos.z = data.z;
      if (typeof data.rotation === "number") remote.targetRot = data.rotation;
      if (typeof data.pitch === "number") remote.targetPitch = data.pitch;
      if (typeof data.health === "number" && data.health !== remote.health) {
        remote.health = data.health;
        this.updateHealthSprite(remote.healthSprite, remote.health);
      }
    }
  }

  removeRemotePlayer(sessionId) {
    const remote = this.remotePlayers.get(sessionId);
    if (remote) {
      this.scene.remove(remote.mesh);
      this.remotePlayers.delete(sessionId);
    }
  }

  updateRemotePlayers(delta) {
    const lerpFactor = Math.min(1.0, delta * 12.0);
    this.remotePlayers.forEach((remote) => {
      remote.mesh.position.lerp(remote.targetPos, lerpFactor);

      // Interpolate rotation
      const targetQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(remote.targetPitch || 0, remote.targetRot || 0, 0, "YXZ")
      );
      remote.mesh.quaternion.slerp(targetQuat, lerpFactor);
    });
  }

  createHealthSprite(health) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 36;
    const texture = new THREE.CanvasTexture(canvas);

    this.drawHealthBar(canvas, health);

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.0, 0.45, 1.0);
    sprite.userData = { canvas, texture };
    return sprite;
  }

  updateHealthSprite(sprite, health) {
    if (!sprite || !sprite.userData) return;
    const { canvas, texture } = sprite.userData;
    this.drawHealthBar(canvas, health);
    texture.needsUpdate = true;
  }

  drawHealthBar(canvas, health) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Frame
    ctx.fillStyle = "rgba(10, 15, 25, 0.85)";
    ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 8);
    ctx.fill();
    ctx.stroke();

    // Fill
    const pct = Math.max(0, Math.min(100, health)) / 100;
    const fillWidth = (w - 14) * pct;

    if (pct < 0.3) {
      ctx.fillStyle = "#ff0055"; // Danger red
    } else if (pct < 0.6) {
      ctx.fillStyle = "#ffaa00"; // Warning amber
    } else {
      ctx.fillStyle = "#00ff88"; // Healthy neon green
    }

    if (fillWidth > 0) {
      ctx.beginPath();
      ctx.roundRect(7, 7, fillWidth, h - 14, 4);
      ctx.fill();
    }
  }

  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    if (this.mesh) this.mesh.position.set(x, y, z);
    this.camera.position.set(x, y + 3.5, z + 9.0);
  }
}
