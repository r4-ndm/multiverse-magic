import * as THREE from "three";
import {
  CAR_HALF,
  createCarMesh,
  carIdForBlock,
  roofSeatForBlock,
  setCarLights,
  preloadCarModels,
} from "./DriveCar.js";

/**
 * GTA-style arcade driving on container roofs — skids + donuts.
 */
export class VehicleSystem {
  constructor(scene) {
    this.scene = scene;
    this.cars = new Map();
    this.playerSystem = null;
    this.worldSystem = null;
    this.audioSystem = null;
    this.onDrivingChange = null;
    this.enterRadius = 5.5;
    this.maxParkedCars = 24;

    // Defaults — overwritten per vehicle on enter.
    this.maxSpeed = 44;
    this.reverseMax = 16;
    this.accelForce = 52;
    this.brakeForce = 78;
    this.coastDrag = 1.05;
    this.frontGrip = 14;
    this.rearGrip = 11;
    this.handbrakeRearGrip = 0.55;
    this.steerPower = 3.1;
    this.suspension = 55;
    this.suspensionDamp = 11;

    this.speed = 0;
    this.velX = 0;
    this.velZ = 0;
    this.yawRate = 0;
    this.springVel = 0;
    this.wheelSpin = 0;
    this.steerAngle = 0;
    this.bodyRoll = 0;
    this.bodyPitch = 0;
    this.slip = 0;
    this.handbrake = false;

    this.chasePos = new THREE.Vector3();
    this.chaseLook = new THREE.Vector3();
    this.chaseReady = false;
    // First-person cabin view by default; F toggles chase.
    this.cabinView = true;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.seatOffset = new THREE.Vector3(-0.36, 1.08, 0.15);
    this.cabinExterior = false;

    this.smokePool = [];
    this.smokeGeom = new THREE.SphereGeometry(0.22, 6, 6);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0xd8d8d8,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this._modelsReady = false;
  }

  init(playerSystem, worldSystem, audioSystem = null) {
    this.playerSystem = playerSystem;
    this.worldSystem = worldSystem;
    this.audioSystem = audioSystem;
    playerSystem.vehicleSystem = this;
    preloadCarModels().then(() => {
      this._modelsReady = true;
      this.refreshParkedMeshes();
    });
  }

  setAudio(audioSystem) {
    this.audioSystem = audioSystem;
  }

  /** Rebuild placeholders once the fleet GLBs finish loading. */
  refreshParkedMeshes() {
    this.cars.forEach((car) => {
      if (car.occupiedBy) return;
      if (car.mesh?.userData?.style && car.mesh.userData.style !== "pending") return;
      const color = car.mesh?.userData?.colorHex || 0xc41230;
      const pos = car.mesh.position.clone();
      const yaw = car.yaw;
      this.scene.remove(car.mesh);
      const mesh = createCarMesh(THREE, color, car.blockId);
      mesh.position.copy(pos);
      mesh.rotation.y = yaw;
      mesh.userData.carId = car.id;
      mesh.userData.blockId = car.blockId;
      this.scene.add(mesh);
      car.mesh = mesh;
      car.kind = mesh.userData.kind;
    });
  }

  applyHandling(handling) {
    const h = handling || {};
    this.maxSpeed = h.maxSpeed ?? 44;
    this.reverseMax = h.reverseMax ?? 16;
    this.accelForce = h.accelForce ?? 52;
    this.brakeForce = h.brakeForce ?? 78;
    this.coastDrag = h.coastDrag ?? 1.05;
    this.frontGrip = h.frontGrip ?? 14;
    this.rearGrip = h.rearGrip ?? 11;
    this.handbrakeRearGrip = h.handbrakeRearGrip ?? 0.55;
    this.steerPower = h.steerPower ?? 3.1;
    this.seatOffset = h.seat
      ? new THREE.Vector3(h.seat[0], h.seat[1], h.seat[2])
      : new THREE.Vector3(-0.36, 1.08, 0.15);
    this.cabinExterior = !!h.cabinExterior;
  }

  spawnForBlock(block) {
    if (!block?.id || !block.mesh) return;
    if (this.cars.size >= this.maxParkedCars) return;
    let hash = 0;
    const id = String(block.id);
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    if ((hash >>> 0) % 5 !== 0 && this.cars.size > 6) return;

    const carId = carIdForBlock(block.id);
    if (this.cars.has(carId)) return;

    const color = this.parseColor(block.color, 0xc41230);
    const mesh = createCarMesh(THREE, color, block.id);
    const seat = roofSeatForBlock(block);
    mesh.position.copy(seat);
    mesh.rotation.y = (Math.random() - 0.5) * 0.6 + Math.PI;
    mesh.userData.carId = carId;
    mesh.userData.blockId = block.id;
    this.scene.add(mesh);
    this.cars.set(carId, {
      id: carId,
      blockId: block.id,
      mesh,
      occupiedBy: null,
      yaw: mesh.rotation.y,
      kind: mesh.userData.kind || "supercar",
    });
  }

  removeForBlock(blockId) {
    const id = carIdForBlock(blockId);
    const car = this.cars.get(id);
    if (!car) return;
    if (this.playerSystem?.drivingCar === car) this.exitCar(true);
    this.scene.remove(car.mesh);
    car.mesh.traverse((child) => {
      child.geometry?.dispose?.();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
    this.cars.delete(id);
  }

  nearestFreeCar(from = this.playerSystem?.position) {
    if (!from) return null;
    let best = null;
    let bestDist = this.enterRadius;
    this.cars.forEach((car) => {
      if (car.occupiedBy && car.occupiedBy !== this.playerSystem?.localId) return;
      if (this.playerSystem?.drivingCar === car) return;
      const dist = from.distanceTo(car.mesh.position);
      if (dist < bestDist) {
        bestDist = dist;
        best = car;
      }
    });
    return best;
  }

  enterNearest() {
    const player = this.playerSystem;
    if (!player || player.drivingCar) return false;
    const car = this.nearestFreeCar();
    if (!car) return false;

    if (!player.gravityOn) player.setGravity(true);
    player.drivingCar = car;
    car.occupiedBy = player.localId || "local";
    car.mesh.visible = true;
    this.applyHandling(car.mesh.userData.handling);
    player.velocity.set(0, 0, 0);
    player.position.copy(car.mesh.position);
    player.euler.y = car.yaw;
    player.euler.x = 0;
    player.quaternion.setFromEuler(player.euler);
    player.grounded = true;

    this.pinAvatarToCar(player.mesh, car.mesh, car.mesh.userData.handling);
    this.refreshLocalDriverVisibility();

    this.speed = 0;
    this.velX = 0;
    this.velZ = 0;
    this.yawRate = 0;
    this.springVel = 0;
    this.steerAngle = 0;
    this.bodyRoll = 0;
    this.bodyPitch = 0;
    this.slip = 0;
    this.chaseReady = false;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.audioSystem?.startEngine?.();
    this.onDrivingChange?.(true, car.mesh.userData.kind || "car");
    return true;
  }

  exitCar(forced = false) {
    const player = this.playerSystem;
    const car = player?.drivingCar;
    if (!car) return;
    this.audioSystem?.stopEngine?.();
    car.occupiedBy = null;
    car.yaw = player.euler.y;
    car.mesh.rotation.set(0, car.yaw, 0);
    car.mesh.position.copy(player.position);
    car.mesh.position.y = this.snapCarY(car.mesh.position) ?? player.position.y;
    if (car.mesh.userData.body) car.mesh.userData.body.rotation.set(0, 0, 0);
    setCarLights(car.mesh, { braking: false, reverse: false, headlights: true });
    car.mesh.visible = true;

    this.unpinAvatar(player.mesh, player.position, player.euler.y);
    player.hideLocalBody();

    const side = new THREE.Vector3(2.6, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.euler.y);
    player.position.add(side);
    player.drivingCar = null;
    player.velocity.set(0, 0, 0);
    this.speed = 0;
    this.yawRate = 0;
    this.chaseReady = false;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.cabinExterior = false;
    if (player.camera) {
      player.camera.fov = 75;
      player.camera.near = 0.1;
      player.camera.updateProjectionMatrix();
    }
    if (!forced && player.gravityOn) player.placeOnContainer();
    this.onDrivingChange?.(false);
  }

  toggleCabinView() {
    this.cabinView = !this.cabinView;
    this.chaseReady = false;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.refreshLocalDriverVisibility();
    return this.cabinView;
  }

  /** Hide local avatar in cabin FPS; show it seated in chase cam. */
  refreshLocalDriverVisibility() {
    const player = this.playerSystem;
    if (!player?.drivingCar || !player.mesh) return;
    player.mesh.visible = !this.cabinView;
    if (player.localNametag) player.localNametag.visible = false;
  }

  /**
   * Parent an avatar into the driver seat so it stays locked to the car.
   */
  pinAvatarToCar(avatar, carMesh, handling = null) {
    if (!avatar || !carMesh) return;
    const seat = handling?.seat || [0, 1.05, 0.15];
    const exterior = !!handling?.cabinExterior;
    // Sit lower than the camera eye; nudge forward a touch in solid-mesh cars.
    const x = seat[0] ?? 0;
    const y = exterior ? Math.max(0.55, (seat[1] ?? 1) * 0.42) : Math.max(0.45, (seat[1] ?? 1) * 0.48);
    const z = exterior ? (seat[2] ?? 0) * 0.35 + 0.15 : (seat[2] ?? 0) * 0.4 + 0.05;

    carMesh.attach(avatar);
    avatar.position.set(x, y, z);
    avatar.rotation.set(0, 0, 0);
    avatar.scale.setScalar(0.82);
    avatar.visible = true;
    avatar.userData.pinnedToCar = true;
  }

  unpinAvatar(avatar, worldPos, worldYaw = 0) {
    if (!avatar) return;
    this.scene.attach(avatar);
    avatar.scale.setScalar(1);
    if (worldPos) avatar.position.copy(worldPos);
    avatar.rotation.set(0, worldYaw, 0);
    avatar.userData.pinnedToCar = false;
  }

  addLook(dx, dy) {
    this.lookYaw -= dx;
    this.lookPitch -= dy;
    this.lookYaw = THREE.MathUtils.clamp(this.lookYaw, -1.15, 1.15);
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch, -0.55, 0.45);
  }

  update(delta) {
    const player = this.playerSystem;
    if (!player?.drivingCar) return;
    this.handbrake = !!(player.keys.down || player.keys.boost);
    this.drive(player, player.drivingCar, delta);
    this.updateSmoke(delta);
  }

  drive(player, car, delta) {
    player.euler.x = 0;

    let throttle = 0;
    if (player.keys.forward) throttle += 1;
    if (player.keys.backward) throttle -= 1;

    let steerInput = 0;
    if (player.keys.left) steerInput += 1;
    if (player.keys.right) steerInput -= 1;

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.euler.y);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.euler.y);

    let forwardSpeed = this.velX * forward.x + this.velZ * forward.z;
    let latSpeed = this.velX * right.x + this.velZ * right.z;

    // Engine / brake along nose.
    if (throttle > 0) {
      const power = this.accelForce * (1 - Math.max(0, forwardSpeed) / this.maxSpeed);
      // Handbrake + gas = wheelspin: more push, less traction later.
      const spin = this.handbrake ? 1.25 : 1;
      this.velX += forward.x * power * spin * delta;
      this.velZ += forward.z * power * spin * delta;
    } else if (throttle < 0) {
      if (forwardSpeed > 1.2) {
        this.velX -= forward.x * this.brakeForce * delta;
        this.velZ -= forward.z * this.brakeForce * delta;
      } else {
        this.velX += forward.x * -this.accelForce * 0.42 * delta;
        this.velZ += forward.z * -this.accelForce * 0.42 * delta;
      }
    } else {
      this.velX -= forward.x * forwardSpeed * this.coastDrag * delta;
      this.velZ -= forward.z * forwardSpeed * this.coastDrag * delta;
    }

    forwardSpeed = this.velX * forward.x + this.velZ * forward.z;
    latSpeed = this.velX * right.x + this.velZ * right.z;

    const steerTarget = steerInput * (this.handbrake ? 0.95 : 0.58);
    this.steerAngle += (steerTarget - this.steerAngle) * Math.min(1, delta * 10);

    const speedAbs = Math.hypot(this.velX, this.velZ);
    const wheelBase = 2.55;
    const maxSteerRad = 0.55;
    const steerRad = this.steerAngle * maxSteerRad;

    // Ackermann-ish yaw from front wheels when moving.
    if (speedAbs > 0.35) {
      const ackermann = (Math.abs(forwardSpeed) / wheelBase) * Math.tan(steerRad);
      this.yawRate += ackermann * Math.sign(forwardSpeed || 1) * delta * 9;
    }

    // Handbrake: dump rear grip → oversteer / donuts.
    if (this.handbrake) {
      const hbSteer = steerInput !== 0 ? steerInput : Math.sign(latSpeed) || Math.sign(this.yawRate) || 1;
      // Kick the rear out.
      this.yawRate += hbSteer * (3.6 + Math.abs(throttle) * 4.2 + Math.min(10, speedAbs) * 0.22) * delta;
      // Convert some forward speed into sideways slide.
      const kick = Math.min(22, 8 + speedAbs * 0.35) * delta * (0.55 + Math.abs(throttle) * 0.55);
      this.velX += right.x * -hbSteer * kick;
      this.velZ += right.z * -hbSteer * kick;

      // Donut sustain: gas + handbrake + steer at low/mid speed.
      if (throttle > 0 && Math.abs(steerInput) > 0.15 && speedAbs < 22) {
        const targetSpin = steerInput * (2.6 + throttle * 2.4);
        this.yawRate += (targetSpin - this.yawRate) * Math.min(1, delta * 4.2);
        // Keep circling — push around the radius.
        const circle = 16 + throttle * 10;
        this.velX += right.x * -steerInput * circle * delta;
        this.velZ += right.z * -steerInput * circle * delta;
        this.velX += forward.x * 10 * throttle * delta;
        this.velZ += forward.z * 10 * throttle * delta;
      }
    } else {
      // Grip damps spin when not locked up.
      this.yawRate *= Math.exp(-3.8 * delta);
      if (this.slip > 5 && Math.abs(steerInput) > 0.2) {
        // Counter-steer help to hold a drift.
        this.yawRate += -Math.sign(latSpeed) * Math.min(1.2, this.slip * 0.08) * delta;
      }
    }

    // Clamp yaw rate (donuts can be snappy but not teleport).
    const yawCap = this.handbrake ? 4.8 : 2.8;
    this.yawRate = THREE.MathUtils.clamp(this.yawRate, -yawCap, yawCap);
    player.euler.y += this.yawRate * delta;
    player.quaternion.setFromEuler(player.euler);

    // Recompute axes after yaw change, then apply axle grip.
    forward.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.euler.y);
    right.set(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.euler.y);
    forwardSpeed = this.velX * forward.x + this.velZ * forward.z;
    latSpeed = this.velX * right.x + this.velZ * right.z;

    const rearGrip = this.handbrake ? this.handbrakeRearGrip : this.rearGrip;
    // Blend front/rear: handbrake mainly kills rear so the car pivots.
    const grip = this.handbrake
      ? rearGrip * 0.35 + this.frontGrip * 0.15
      : (this.frontGrip + this.rearGrip) * 0.5;
    const latKill = Math.min(1, grip * delta);
    this.velX -= right.x * latSpeed * latKill;
    this.velZ -= right.z * latSpeed * latKill;
    this.slip = Math.abs(latSpeed) + Math.abs(this.yawRate) * 2.2;

    // Cap speed.
    const speed = Math.hypot(this.velX, this.velZ);
    const cap = throttle < 0 && forwardSpeed < 0 ? this.reverseMax : this.maxSpeed;
    if (speed > cap) {
      const s = cap / speed;
      this.velX *= s;
      this.velZ *= s;
    }
    forwardSpeed = this.velX * forward.x + this.velZ * forward.z;
    this.speed = Math.hypot(this.velX, this.velZ) * Math.sign(forwardSpeed || 1);

    player.position.x += this.velX * delta;
    player.position.z += this.velZ * delta;
    player.velocity.x = this.velX;
    player.velocity.z = this.velZ;

    const floor = this.snapCarY(player.position);
    if (floor != null) {
      const gap = floor - player.position.y;
      this.springVel += gap * this.suspension * delta;
      this.springVel *= Math.exp(-this.suspensionDamp * delta);
      player.position.y += this.springVel * delta;
      if (player.position.y < floor - 0.1) {
        player.position.y = floor - 0.1;
        this.springVel = Math.max(0, this.springVel);
      }
      if (player.position.y > floor + 0.65) {
        player.position.y = floor + 0.65;
        this.springVel = Math.min(0, this.springVel);
      }
      player.grounded = Math.abs(player.position.y - floor) < 0.25;
      car.mesh.userData.wheels?.forEach((w) => {
        const compress = THREE.MathUtils.clamp(-gap * 0.15, -0.06, 0.08);
        w.position.y = (w.userData.restY || w.position.y) + compress;
      });
    } else {
      player.grounded = false;
      this.springVel -= 38 * delta;
      if (this.springVel < -55) this.springVel = -55;
      player.position.y += this.springVel * delta;
      if (player.position.y < -40) {
        this.exitCar(true);
        player.setGravity(false);
        return;
      }
    }
    player.velocity.y = this.springVel;

    latSpeed = this.velX * right.x + this.velZ * right.z;
    const rollTarget = -THREE.MathUtils.clamp(latSpeed / 14 + this.yawRate * 0.08, -1, 1) * 0.34;
    const pitchTarget = THREE.MathUtils.clamp(
      -this.springVel * 0.012 + (throttle > 0 ? -0.06 : throttle < 0 ? 0.08 : 0),
      -0.16,
      0.16
    );
    this.bodyRoll += (rollTarget - this.bodyRoll) * Math.min(1, delta * 7);
    this.bodyPitch += (pitchTarget - this.bodyPitch) * Math.min(1, delta * 7);

    car.yaw = player.euler.y;
    car.mesh.position.set(player.position.x, player.position.y, player.position.z);
    car.mesh.rotation.set(0, car.yaw, 0);
    if (car.mesh.userData.body) {
      car.mesh.userData.body.rotation.z = this.bodyRoll;
      car.mesh.userData.body.rotation.x = this.bodyPitch;
    }

    // Wheel spin: locked rear under handbrake still smears visually.
    const spinSpeed = this.handbrake && throttle > 0
      ? Math.max(Math.abs(this.speed), 18)
      : this.speed;
    this.wheelSpin += spinSpeed * delta * 0.62;
    const steerVis = this.steerAngle * 0.85;
    car.mesh.userData.wheels?.forEach((wheel) => {
      // Ferrari-style wheel pivots: yaw for steer, pitch for roll.
      if (wheel.userData.front) {
        wheel.rotation.order = "YXZ";
        wheel.rotation.y = steerVis;
      } else {
        wheel.rotation.y = 0;
      }
      const spin = this.handbrake && !wheel.userData.front && throttle > 0
        ? this.wheelSpin * 1.8
        : this.handbrake && !wheel.userData.front
          ? this.wheelSpin * 0.12
          : this.wheelSpin;
      wheel.rotation.x = spin;
    });

    const braking = throttle < 0 && forwardSpeed > 1;
    setCarLights(car.mesh, {
      braking: braking || this.handbrake,
      reverse: throttle < 0 && forwardSpeed < 0.5,
      headlights: true,
    });

    const drifting = player.grounded && (this.slip > 4.5 || (this.handbrake && speedAbs > 2));
    if (drifting) {
      this.spawnSmoke(player.position, car.yaw, this.handbrake && throttle > 0);
      if (this.handbrake && Math.abs(this.yawRate) > 1.5) {
        this.spawnSmoke(player.position, car.yaw, true);
      }
    }

    this.audioSystem?.updateEngine?.(Math.abs(this.speed), Math.abs(throttle), this.slip);
  }

  spawnSmoke(pos, yaw, heavy = false) {
    let puff = this.smokePool.find((p) => !p.active);
    if (!puff) {
      if (this.smokePool.length > 56) return;
      const mesh = new THREE.Mesh(this.smokeGeom, this.smokeMat.clone());
      this.scene.add(mesh);
      puff = { mesh, active: false, life: 0 };
      this.smokePool.push(puff);
    }
    puff.active = true;
    puff.life = heavy ? 0.7 : 0.5;
    const side = (Math.random() > 0.5 ? 1 : -1) * (0.75 + Math.random() * 0.35);
    const back = new THREE.Vector3(side, 0.12, 1.15 + Math.random() * 0.3)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    puff.mesh.position.set(pos.x + back.x, pos.y + 0.08, pos.z + back.z);
    puff.mesh.scale.setScalar((heavy ? 0.85 : 0.55) + Math.random() * 0.45);
    puff.mesh.material.opacity = heavy ? 0.5 : 0.38;
    puff.mesh.visible = true;
  }

  updateSmoke(delta) {
    for (const puff of this.smokePool) {
      if (!puff.active) continue;
      puff.life -= delta;
      puff.mesh.position.y += delta * 0.7;
      puff.mesh.scale.multiplyScalar(1 + delta * 2.0);
      puff.mesh.material.opacity = Math.max(0, puff.life * 0.75);
      if (puff.life <= 0) {
        puff.active = false;
        puff.mesh.visible = false;
      }
    }
  }

  updateDriveCamera(camera, player, delta) {
    if (!player?.drivingCar || !camera) return;
    const speedAbs = Math.hypot(this.velX, this.velZ);
    const yaw = player.euler.y;

    if (this.cabinView) {
      const seatLocal = (this.seatOffset || new THREE.Vector3(-0.36, 1.08, 0.15)).clone();
      seatLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      seatLocal.y += this.bodyRoll * 0.05;
      const eye = player.position.clone().add(seatLocal);

      // Always look out the nose; mouse only adds a small look-around.
      const lookYaw = yaw + this.lookYaw;
      const lookPitch = this.lookPitch + this.bodyPitch * 0.25;
      const lookDir = new THREE.Vector3(0, 0, -1)
        .applyEuler(new THREE.Euler(lookPitch, lookYaw, 0, "YXZ"));
      const look = eye.clone().add(lookDir.multiplyScalar(14));

      camera.position.copy(eye);
      camera.lookAt(look);
      // Exterior dashcam sits outside solid meshes; interior needs a tiny near plane.
      camera.near = this.cabinExterior ? 0.2 : 0.08;
      const fovTarget = (this.cabinExterior ? 70 : 74) + Math.min(12, speedAbs * 0.25) + (this.handbrake ? 3 : 0);
      camera.fov += (fovTarget - camera.fov) * Math.min(1, delta * 3.2);
      camera.updateProjectionMatrix();
      return;
    }

    const lookAhead = 8 + Math.min(10, speedAbs * 0.2);
    const back = 5.6 + Math.min(3.5, speedAbs * 0.06);
    const up = 2.15 + Math.min(0.9, speedAbs * 0.015);
    const swing = THREE.MathUtils.clamp(this.yawRate * 0.18 + this.slip * 0.02, -0.7, 0.7);

    const ideal = player.position.clone().add(
      new THREE.Vector3(swing * 2.2, up, back).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    );
    const look = player.position.clone().add(
      new THREE.Vector3(0, 1.15, -lookAhead).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    );

    if (!this.chaseReady) {
      this.chasePos.copy(ideal);
      this.chaseLook.copy(look);
      this.chaseReady = true;
    } else {
      const follow = 1 - Math.exp(-(this.handbrake ? 2.4 : 3.8) * delta);
      this.chasePos.lerp(ideal, follow);
      this.chaseLook.lerp(look, follow);
    }

    camera.near = 0.1;
    camera.position.copy(this.chasePos);
    camera.lookAt(this.chaseLook);
    const fovTarget = 68 + Math.min(22, speedAbs * 0.4) + (this.handbrake ? 5 : 0);
    camera.fov += (fovTarget - camera.fov) * Math.min(1, delta * 3.2);
    camera.updateProjectionMatrix();
  }

  snapCarY(pos) {
    const boxes = this.playerSystem?.containerBoxes?.() || [];
    const inset = 0.45;
    let floor = null;
    for (const box of boxes) {
      const over =
        pos.x + inset > box.minX &&
        pos.x - inset < box.maxX &&
        pos.z + inset > box.minZ &&
        pos.z - inset < box.maxZ;
      if (!over) continue;
      const gap = pos.y - (box.maxY + CAR_HALF.y);
      if (gap > 1.5 || gap < -1.8) continue;
      const y = box.maxY + CAR_HALF.y;
      if (floor == null || y > floor) floor = y;
    }
    return floor;
  }

  getSpeedKmh() {
    return Math.abs(this.speed) * 3.6 * 1.15;
  }

  updateRemoteCar(remote) {
    if (!remote?.driveMesh || !remote.driveMesh.visible) return;
    remote.driveMesh.position.lerp(remote.targetPos, 0.35);
    remote.driveMesh.rotation.y = remote.targetRot || 0;
    // Keep avatar seated if it somehow detached.
    if (remote.mesh && remote.mesh.parent !== remote.driveMesh) {
      this.pinAvatarToCar(remote.mesh, remote.driveMesh, remote.driveMesh.userData.handling);
    }
    this.cars.forEach((car) => {
      if (car.occupiedBy) return;
      const near = car.mesh.position.distanceTo(remote.driveMesh.position) < 6;
      car.mesh.visible = !near;
    });
  }

  syncRemoteDriver(sessionId, remote, driving) {
    if (!remote) return;
    if (driving) {
      if (!remote.driveMesh) {
        const mesh = createCarMesh(THREE, remote.colorHex || 0x2a6dff, sessionId);
        this.scene.add(mesh);
        remote.driveMesh = mesh;
      }
      remote.driveMesh.visible = true;
      remote.driveMesh.position.copy(remote.targetPos || remote.mesh.position);
      remote.driveMesh.rotation.y = remote.targetRot || 0;
      this.pinAvatarToCar(remote.mesh, remote.driveMesh, remote.driveMesh.userData.handling);
      if (remote.nametagSprite) remote.nametagSprite.position.y = 2.6;
    } else if (remote.driveMesh) {
      const pos = remote.driveMesh.position.clone();
      const yaw = remote.driveMesh.rotation.y;
      this.unpinAvatar(remote.mesh, pos, yaw);
      remote.driveMesh.visible = false;
      if (remote.mesh) remote.mesh.visible = true;
      if (remote.nametagSprite) remote.nametagSprite.position.y = 3.4;
      this.cars.forEach((car) => {
        if (!car.occupiedBy) car.mesh.visible = true;
      });
    }
  }

  parseColor(color, fallback) {
    if (typeof color === "number") return color;
    if (typeof color === "string") {
      const n = parseInt(color.replace("#", "0x"), 16);
      if (!Number.isNaN(n)) return n;
    }
    return fallback;
  }
}
