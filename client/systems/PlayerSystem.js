import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { characterRegistry } from "../characters/index.js";
import { mountCharacter } from "../characters/present.js";
import { createPixelCard } from "../characters/pixelCard.js";
import { isImageAvatar } from "../ui/portrait.js";
import { BLOCK_SIZE } from "./BuildBlock.js";

/**
 * PlayerSystem manages the local player's controls, space flight physics (with inertia),
 * first-person camera, avatar loading, and remote player mesh management.
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
    this.deepCruise = 32.0;
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

    // First person only. Local mesh stays hidden so it never blocks the view.
    this.cameraMode = "fps";

    // Gravity drops you onto container roofs so you can walk them. Off = space flight.
    this.gravityOn = false;
    this.grounded = false;
    this.jumpCooldown = 0;
    this.walkTime = 0;
    this.worldSystem = null;
    this.onGravityChange = null;
    this.playerRadius = 0.55;
    this.playerHeight = 1.8;
    this.walkSpeed = 16;
    this.gravityAccel = 36;
    this.jumpSpeed = 11;
    this.floorY = null;
    this.eyeBob = 0;
    this.drivingCar = null;
    this.vehicleSystem = null;

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

    this.characterType = "wizard";
    this.characterColor = 0x9d00ff;

    // Create local player avatar (Purple Wizard with Thor's Hammer by default)
    this.mesh = this.createCharacterMesh(this.characterType, this.characterColor);
    this.scene.add(this.mesh);

    // Create holographic nametag above local ship
    this.localName = "YOU";
    this.localNametag = this.createNametagSprite(this.localName, 100, true);
    this.localNametag.position.set(0, 3.4, 0);
    this.mesh.add(this.localNametag);

    this.hideLocalBody();

    // Setup input listeners
    this.setupInputs();
  }

  hideLocalBody() {
    if (this.mesh) this.mesh.visible = false;
    if (this.localNametag) this.localNametag.visible = false;
  }

  setLocalCharacter(type = "astronaut", color = "#00f0ff", avatarUrl = "") {
    this.characterType = type;
    const colorHex = typeof color === "number" ? color : parseInt(color.replace("#", "0x"), 16);
    this.characterColor = colorHex;

    if (avatarUrl && avatarUrl.trim()) {
      const url = avatarUrl.trim();
      if (isImageAvatar(url)) {
        this.swapMesh(createPixelCard(THREE, url));
        return;
      }
      this.gltfLoader.load(
        url,
        (gltf) => {
          this.swapMesh(mountCharacter(THREE, gltf));
        },
        undefined,
        (err) => {
          console.warn("[PlayerSystem] Failed loading custom avatar, fallback to preset:", err);
          const newMesh = this.createCharacterMesh(type, colorHex);
          this.swapMesh(newMesh);
        }
      );
    } else {
      const newMesh = this.createCharacterMesh(type, colorHex);
      this.swapMesh(newMesh);
    }
  }

  swapMesh(newMesh) {
    if (!this.mesh) return;
    const pos = this.mesh.position.clone();
    const quat = this.mesh.quaternion.clone();

    // Detach nametag
    if (this.localNametag) {
      this.mesh.remove(this.localNametag);
    }

    this.scene.remove(this.mesh);
    this.mesh = newMesh;
    this.mesh.position.copy(pos);
    this.mesh.quaternion.copy(quat);
    this.hideLocalBody();

    // Re-attach nametag
    if (this.localNametag) {
      this.localNametag.position.set(0, 3.4, 0);
      this.localNametag.visible = false;
      this.mesh.add(this.localNametag);
    }

    this.scene.add(this.mesh);
  }

  setLocalName(name) {
    if (!name) return;
    this.localName = name;
    if (this.localNametag) {
      this.updateNametagSprite(this.localNametag, this.localName, this.health);
    }
  }

  setLocalHealth(health) {
    this.health = health;
    if (this.localNametag) {
      this.updateNametagSprite(this.localNametag, this.localName, this.health);
    }
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

  /**
   * Generates a 3D Humanoid Astronaut / Space Explorer.
   */
  createAstronautMesh(accentColor = 0x00f0ff) {
    const group = new THREE.Group();

    // 1. Torso Space Suit
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.4,
      metalness: 0.1,
    });
    const torsoGeo = new THREE.CylinderGeometry(0.55, 0.45, 1.3, 10);
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.y = 0.65;
    group.add(torso);

    // Chest control unit
    const chestGeo = new THREE.BoxGeometry(0.4, 0.45, 0.2);
    const chestMat = new THREE.MeshStandardMaterial({
      color: 0x222630,
      metalness: 0.6,
      roughness: 0.2,
    });
    const chest = new THREE.Mesh(chestGeo, chestMat);
    chest.position.set(0, 0.75, 0.35);
    group.add(chest);

    // Glowing chest LED
    const ledGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
    const ledMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 0.8, 0.46);
    group.add(led);

    // 2. Helmet & Visor
    const helmetGeo = new THREE.SphereGeometry(0.42, 16, 16);
    const helmet = new THREE.Mesh(helmetGeo, suitMat);
    helmet.position.y = 1.6;
    group.add(helmet);

    // Reflective Gold/Neon Visor
    const visorGeo = new THREE.SphereGeometry(0.34, 16, 16, 0, Math.PI, 0, Math.PI / 1.5);
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.3,
      metalness: 0.9,
      roughness: 0.1,
      clearcoat: 1.0,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.rotation.y = -Math.PI / 2;
    visor.rotation.x = -Math.PI / 6;
    visor.position.set(0, 1.6, 0.14);
    group.add(visor);

    // 3. Life-Support Jetpack (Backpack)
    const packGeo = new THREE.BoxGeometry(0.8, 0.9, 0.35);
    const packMat = new THREE.MeshStandardMaterial({
      color: 0x333b4d,
      roughness: 0.3,
      metalness: 0.7,
    });
    const pack = new THREE.Mesh(packGeo, packMat);
    pack.position.set(0, 0.75, -0.36);
    group.add(pack);

    // Dual mini rocket thruster nozzles
    [-0.25, 0.25].forEach((xOffset) => {
      const jetGeo = new THREE.CylinderGeometry(0.1, 0.16, 0.3, 8);
      const jetMat = new THREE.MeshBasicMaterial({ color: accentColor });
      const jet = new THREE.Mesh(jetGeo, jetMat);
      jet.position.set(xOffset, 0.25, -0.38);
      group.add(jet);

      const jetLight = new THREE.PointLight(accentColor, 1.5, 8);
      jetLight.position.set(xOffset, 0.15, -0.45);
      group.add(jetLight);
    });

    // 4. Arms
    [-0.75, 0.75].forEach((xOffset) => {
      const armGeo = new THREE.CapsuleGeometry(0.16, 0.7, 8, 8);
      const arm = new THREE.Mesh(armGeo, suitMat);
      arm.position.set(xOffset, 0.6, 0.05);
      arm.rotation.z = xOffset > 0 ? -0.2 : 0.2;
      group.add(arm);
    });

    // 5. Legs & Space Boots
    [-0.32, 0.32].forEach((xOffset) => {
      const legGeo = new THREE.CapsuleGeometry(0.18, 0.8, 8, 8);
      const leg = new THREE.Mesh(legGeo, suitMat);
      leg.position.set(xOffset, -0.3, 0);
      group.add(leg);

      const bootGeo = new THREE.BoxGeometry(0.26, 0.2, 0.38);
      const boot = new THREE.Mesh(bootGeo, chestMat);
      boot.position.set(xOffset, -0.8, 0.06);
      group.add(boot);
    });

    // Hitbox for combat raycasting
    const hitBoxGeo = new THREE.BoxGeometry(2.0, 2.8, 1.8);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.name = "hitbox";
    group.add(hitBox);

    group.scale.set(1.4, 1.4, 1.4);
    return group;
  }

  /**
   * Generates a Cyber Mecha / Android Humanoid.
   */
  createAndroidMesh(accentColor = 0x9d00ff) {
    const group = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e29,
      roughness: 0.25,
      metalness: 0.9,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: accentColor });

    // Angular Torso
    const torsoGeo = new THREE.BoxGeometry(0.9, 1.3, 0.6);
    const torso = new THREE.Mesh(torsoGeo, metalMat);
    torso.position.y = 0.65;
    group.add(torso);

    // Glowing Arc Reactor Core
    const coreGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
    coreGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(coreGeo, glowMat);
    core.position.set(0, 0.8, 0.32);
    group.add(core);

    // Android Head with cyclops visor
    const headGeo = new THREE.BoxGeometry(0.5, 0.55, 0.55);
    const head = new THREE.Mesh(headGeo, metalMat);
    head.position.y = 1.6;
    group.add(head);

    const eyeGeo = new THREE.BoxGeometry(0.38, 0.08, 0.1);
    const eye = new THREE.Mesh(eyeGeo, glowMat);
    eye.position.set(0, 1.62, 0.28);
    group.add(eye);

    // Shoulder Pauldrons & Arms
    [-0.75, 0.75].forEach((x) => {
      const pauldronGeo = new THREE.ConeGeometry(0.32, 0.5, 4);
      const pauldron = new THREE.Mesh(pauldronGeo, metalMat);
      pauldron.position.set(x, 1.15, 0);
      pauldron.rotation.z = x > 0 ? -Math.PI / 2.5 : Math.PI / 2.5;
      group.add(pauldron);

      const armGeo = new THREE.BoxGeometry(0.24, 0.9, 0.24);
      const arm = new THREE.Mesh(armGeo, metalMat);
      arm.position.set(x, 0.5, 0);
      group.add(arm);
    });

    // Legs
    [-0.32, 0.32].forEach((x) => {
      const legGeo = new THREE.BoxGeometry(0.28, 1.1, 0.28);
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(x, -0.45, 0);
      group.add(leg);
    });

    // Rear Jet Thruster
    const thrusterGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.5, 8);
    thrusterGeo.rotateX(Math.PI / 2);
    const thruster = new THREE.Mesh(thrusterGeo, glowMat);
    thruster.position.set(0, 0.6, -0.45);
    group.add(thruster);

    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 1.8), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.name = "hitbox";
    group.add(hitBox);

    group.scale.set(1.4, 1.4, 1.4);
    return group;
  }

  /**
   * Generates an Ethereal Celestial Cosmic Being.
   */
  createCelestialMesh(accentColor = 0xffd700) {
    const group = new THREE.Group();

    // 1. Inner Core Energy Sphere
    const coreGeo = new THREE.SphereGeometry(0.7, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    const auraGeo = new THREE.SphereGeometry(0.9, 16, 16);
    const auraMat = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Mesh(auraGeo, auraMat));

    // 2. Gyroscopic Rotating Rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 12, 48), ringMat);
    group.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.04, 12, 48), ringMat);
    ring2.rotation.x = Math.PI / 2.5;
    group.add(ring2);

    // Orbiting sacred crystals
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const crystalGeo = new THREE.OctahedronGeometry(0.2);
      const crystal = new THREE.Mesh(crystalGeo, coreMat);
      crystal.position.set(Math.cos(angle) * 1.5, Math.sin(angle) * 0.6, Math.sin(angle) * 1.5);
      group.add(crystal);
    }

    const hitBox = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.name = "hitbox";
    group.add(hitBox);

    return group;
  }

  /**
   * Generates an Epic Purple Wizard wielding Thor's Hammer (Mjölnir).
   */
  createWizardMesh(accentColor = 0x9d00ff) {
    const group = new THREE.Group();

    // 1. Wizard Robes (Royal Purple)
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0x4a148c, // Deep mystical royal purple
      roughness: 0.6,
      metalness: 0.1,
    });
    const mantleMat = new THREE.MeshStandardMaterial({
      color: 0x311b92, // Dark indigo shoulder mantle
      roughness: 0.5,
      metalness: 0.15,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.85,
      roughness: 0.25,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const lightningMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff }); // Electric Cyan

    // Flared Robe Body
    const robeGeo = new THREE.CylinderGeometry(0.38, 0.72, 1.5, 12);
    const robe = new THREE.Mesh(robeGeo, robeMat);
    robe.position.y = 0.5;
    group.add(robe);

    // Shoulder Mantle / Cloak
    const mantleGeo = new THREE.CylinderGeometry(0.62, 0.68, 0.38, 10);
    const mantle = new THREE.Mesh(mantleGeo, mantleMat);
    mantle.position.y = 1.15;
    group.add(mantle);

    // Golden Rune Belt & Buckle
    const beltGeo = new THREE.CylinderGeometry(0.44, 0.46, 0.12, 12);
    const belt = new THREE.Mesh(beltGeo, goldMat);
    belt.position.y = 0.75;
    group.add(belt);

    const buckleGeo = new THREE.BoxGeometry(0.18, 0.18, 0.14);
    const buckle = new THREE.Mesh(buckleGeo, glowMat);
    buckle.position.set(0, 0.75, 0.42);
    group.add(buckle);

    // 2. Head, Beard & Glowing Eyes
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.7 });
    const headGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.45;
    group.add(head);

    // Flowing Wizard Beard (silver-white)
    const beardMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5 });
    const beardGeo = new THREE.ConeGeometry(0.22, 0.7, 6);
    beardGeo.rotateX(Math.PI);
    const beard = new THREE.Mesh(beardGeo, beardMat);
    beard.position.set(0, 1.15, 0.22);
    group.add(beard);

    // Glowing Eyes peering under hat brim
    [-0.09, 0.09].forEach((x) => {
      const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
      const eye = new THREE.Mesh(eyeGeo, lightningMat);
      eye.position.set(x, 1.5, 0.24);
      group.add(eye);
    });

    // 3. Pointed Wizard Hat
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 1.62, 0);

    // Wide Hat Brim
    const brimGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.05, 16);
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0x6a1b9a, // Vibrant wizard purple
      roughness: 0.4,
      metalness: 0.2,
    });
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.rotation.x = -0.1; // tilted
    hatGroup.add(brim);

    // Golden Hat Band with Rune
    const hatBandGeo = new THREE.CylinderGeometry(0.48, 0.52, 0.12, 12);
    const hatBand = new THREE.Mesh(hatBandGeo, goldMat);
    hatBand.position.y = 0.08;
    hatGroup.add(hatBand);

    // Pointed Hat Cone (crooked at tip)
    const coneGeo = new THREE.ConeGeometry(0.46, 1.25, 12);
    const cone = new THREE.Mesh(coneGeo, hatMat);
    cone.position.set(0, 0.65, -0.08);
    cone.rotation.x = -0.16;
    hatGroup.add(cone);

    const tipGeo = new THREE.ConeGeometry(0.18, 0.45, 8);
    const tip = new THREE.Mesh(tipGeo, hatMat);
    tip.position.set(0, 1.3, -0.25);
    tip.rotation.x = -0.45;
    hatGroup.add(tip);

    group.add(hatGroup);

    // 4. Arms & Sleeves
    // Left Arm: Billowing sleeve raised in arcane spellcasting pose
    const leftArmGeo = new THREE.CylinderGeometry(0.18, 0.26, 0.85, 8);
    const leftArm = new THREE.Mesh(leftArmGeo, mantleMat);
    leftArm.position.set(-0.65, 0.95, 0.2);
    leftArm.rotation.set(0.3, 0, 0.4);
    group.add(leftArm);

    // Left hand with glowing arcane spell orb
    const spellOrbGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const spellOrb = new THREE.Mesh(spellOrbGeo, glowMat);
    spellOrb.position.set(-0.85, 1.25, 0.4);
    group.add(spellOrb);

    // Right Arm: Reaching forward wielding Thor's Hammer
    const rightArmGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.8, 8);
    const rightArm = new THREE.Mesh(rightArmGeo, mantleMat);
    rightArm.position.set(0.62, 0.85, 0.25);
    rightArm.rotation.set(-0.5, 0, -0.3);
    group.add(rightArm);

    // 5. THOR'S HAMMER (MJÖLNIR)
    const hammerGroup = new THREE.Group();
    hammerGroup.position.set(0.78, 0.85, 0.75);
    hammerGroup.rotation.set(0.2, 0.3, -0.4);

    // Uru Forged Metal Material
    const uruMat = new THREE.MeshStandardMaterial({
      color: 0x85929e, // Forged Asgardian Uru silver-grey
      metalness: 0.92,
      roughness: 0.18,
    });
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x4e342e, // Dark Nordic leather grip
      roughness: 0.75,
      metalness: 0.1,
    });

    // Mjölnir Hammer Head (Beveled Heavy Block)
    const headBlockGeo = new THREE.BoxGeometry(0.52, 0.34, 0.34);
    const headBlock = new THREE.Mesh(headBlockGeo, uruMat);
    headBlock.position.y = 0.38;
    hammerGroup.add(headBlock);

    // Beveled Face Plates on front/rear of hammer
    [-0.27, 0.27].forEach((x) => {
      const faceGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.06, 8);
      faceGeo.rotateZ(Math.PI / 2);
      const face = new THREE.Mesh(faceGeo, uruMat);
      face.position.set(x, 0.38, 0);
      hammerGroup.add(face);
    });

    // Carved Nordic Runes (Glowing Cyan / Electric Arc)
    const runeGeo = new THREE.BoxGeometry(0.38, 0.06, 0.36);
    const rune = new THREE.Mesh(runeGeo, lightningMat);
    rune.position.set(0, 0.38, 0);
    hammerGroup.add(rune);

    // Hammer Handle / Grip
    const handleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.55, 8);
    const handle = new THREE.Mesh(handleGeo, leatherMat);
    handle.position.y = 0.05;
    hammerGroup.add(handle);

    // Grip Rings
    for (let i = -1; i <= 1; i++) {
      const ringGeo = new THREE.TorusGeometry(0.05, 0.012, 6, 12);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, goldMat);
      ring.position.y = 0.05 + i * 0.12;
      hammerGroup.add(ring);
    }

    // Pommel & Wrist Strap Ring
    const pommelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8);
    const pommel = new THREE.Mesh(pommelGeo, uruMat);
    pommel.position.y = -0.23;
    hammerGroup.add(pommel);

    const strapGeo = new THREE.TorusGeometry(0.07, 0.016, 6, 12);
    const strap = new THREE.Mesh(strapGeo, leatherMat);
    strap.position.set(0, -0.3, 0);
    strap.rotation.x = Math.PI / 3;
    hammerGroup.add(strap);

    // Crackling Lightning Sparks around Mjölnir
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const sparkGeo = new THREE.OctahedronGeometry(0.05 + Math.random() * 0.04);
      const spark = new THREE.Mesh(sparkGeo, lightningMat);
      spark.position.set(
        Math.cos(angle) * 0.28,
        0.38 + (Math.random() - 0.5) * 0.22,
        Math.sin(angle) * 0.28
      );
      hammerGroup.add(spark);
    }

    // Mjölnir Lightning Light
    const hammerLight = new THREE.PointLight(0x00f0ff, 2.5, 8);
    hammerLight.position.set(0, 0.45, 0);
    hammerGroup.add(hammerLight);

    group.add(hammerGroup);

    // 6. Hitbox for combat raycasting
    const hitBoxGeo = new THREE.BoxGeometry(2.0, 3.2, 1.8);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.name = "hitbox";
    group.add(hitBox);

    group.scale.set(1.4, 1.4, 1.4);
    return group;
  }

  /**
   * Unified character factory supporting all multiverse character types.
   */
  createCharacterMesh(type = "wizard", accentColor = 0x9d00ff) {
    if (characterRegistry.has(type)) {
      return characterRegistry.createMesh(type, accentColor);
    }
    switch (type) {
      case "wizard":
      case "mage":
      case "sorcerer":
        return this.createWizardMesh(accentColor);
      case "astronaut":
      case "humanoid":
        return this.createAstronautMesh(accentColor);
      case "android":
      case "mecha":
        return this.createAndroidMesh(accentColor);
      case "celestial":
      case "cosmic":
        return this.createCelestialMesh(accentColor);
      case "frog":
      case "cosmic_frog":
      case "toad":
        return characterRegistry.createMesh("frog", accentColor);
      case "squirrel":
      case "galactic_squirrel":
      case "chipmunk":
        return characterRegistry.createMesh("squirrel", accentColor);
      case "vessel":
      case "ship":
      default:
        return this.createSpaceshipMesh(accentColor);
    }
  }

  setupInputs() {
    window.addEventListener("keydown", (e) => {
      switch (e.code) {
        case "KeyW": this.keys.forward = true; break;
        case "KeyS": this.keys.backward = true; break;
        case "KeyA": this.keys.left = true; break;
        case "KeyD": this.keys.right = true; break;
        case "KeyQ": this.keys.up = true; break;
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
        case "KeyQ": this.keys.up = false; break;
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

    // Tab key toggles pointer lock
    window.addEventListener("keydown", (e) => {
      if (e.code === "Tab") {
        e.preventDefault();
        if (document.pointerLockElement === this.domElement) {
          document.exitPointerLock();
        } else {
          this.domElement.requestPointerLock();
        }
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.isPointerLocked = document.pointerLockElement === this.domElement;
      const crosshair = document.getElementById("crosshair");
      if (crosshair) {
        crosshair.style.display = "block";
        crosshair.style.opacity = this.isPointerLocked ? "1.0" : "0.5";
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isPointerLocked) return;

      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      if (this.drivingCar) {
        // Mouse looks around the cabin; A/D steers the car.
        this.vehicleSystem?.addLook?.(
          movementX * this.mouseSensitivity,
          movementY * this.mouseSensitivity
        );
        this.euler.x = 0;
      } else {
        this.euler.y -= movementX * this.mouseSensitivity;
        this.euler.x -= movementY * this.mouseSensitivity;
        this.euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.euler.x));
      }

      this.quaternion.setFromEuler(this.euler);
    });

  }

  toggleGravity() {
    this.setGravity(!this.gravityOn);
    return this.gravityOn;
  }

  setGravity(on) {
    if (!on && this.drivingCar) this.vehicleSystem?.exitCar(true);
    this.gravityOn = !!on;
    this.grounded = false;
    this.jumpCooldown = 0;
    this.floorY = null;
    this.eyeBob = 0;
    this.walkTime = 0;
    this.velocity.set(0, 0, 0);
    if (this.gravityOn) this.placeOnContainer();
    this.onGravityChange?.(this.gravityOn);
  }

  /**
   * Updates local flight, inertia, and the first-person camera.
   */
  update(delta) {
    if (!this.mesh) return;
    this._lastDelta = delta;

    if (this.drivingCar) {
      this.vehicleSystem?.update(delta);
    } else if (this.gravityOn) {
      this.updateWalk(delta);
    } else {
      this.updateFlight(delta);
    }

    // When pinned to a car, the vehicle owns the avatar transform.
    if (!(this.drivingCar && this.mesh.userData.pinnedToCar)) {
      this.mesh.position.copy(this.position);
      if (this.gravityOn) {
        this.mesh.quaternion.setFromEuler(new THREE.Euler(0, this.euler.y, 0, "YXZ"));
      } else {
        this.mesh.quaternion.copy(this.quaternion);
      }
    }
    this.mesh.userData.animate?.(delta, this.camera);

    this.updateCamera();
    this.updateRemotePlayers(delta);
  }

  updateFlight(delta) {
    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.z -= 1;
    if (this.keys.backward) moveDir.z += 1;
    if (this.keys.left) moveDir.x -= 1;
    if (this.keys.right) moveDir.x += 1;
    if (this.keys.up) moveDir.y += 1;
    if (this.keys.down) moveDir.y -= 1;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      moveDir.applyQuaternion(this.quaternion);
      this.velocity.addScaledVector(moveDir, this.thrustForce * delta);
    }

    const far = this.position.length() > 600;
    const limit = far ? Math.min(this.maxSpeed, this.deepCruise) : this.maxSpeed;
    this.returnSpeed = limit;
    if (this.velocity.length() > limit) {
      this.velocity.setLength(limit);
    }

    this.velocity.multiplyScalar(Math.pow(this.drag, delta * 60));
    this.slideAgainstContainers(delta);
  }

  updateWalk(delta) {
    this.jumpCooldown = Math.max(0, this.jumpCooldown - delta);
    const forward = this.walkForward();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    const wish = new THREE.Vector3();
    if (this.keys.forward) wish.add(forward);
    if (this.keys.backward) wish.sub(forward);
    if (this.keys.right) wish.add(right);
    if (this.keys.left) wish.sub(right);

    const moving = wish.lengthSq() > 0;
    if (moving) wish.normalize();
    this.velocity.x = wish.x * this.walkSpeed;
    this.velocity.z = wish.z * this.walkSpeed;

    if (this.keys.up && this.grounded && this.jumpCooldown <= 0) {
      this.velocity.y = this.jumpSpeed;
      this.grounded = false;
      this.floorY = null;
      this.jumpCooldown = 0.32;
    } else if (!this.grounded) {
      this.velocity.y -= this.gravityAccel * delta;
      if (this.velocity.y < -48) this.velocity.y = -48;
    } else {
      this.velocity.y = 0;
    }

    if (moving && this.grounded) this.walkTime += delta * 8;
    else this.walkTime *= Math.max(0, 1 - delta * 10);

    this.walkAgainstContainers(delta);
    this.returnSpeed = this.walkSpeed;
  }

  walkForward() {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 0.04) {
      forward.set(-Math.sin(this.euler.y), 0, -Math.cos(this.euler.y));
    }
    return forward.normalize();
  }

  walkAgainstContainers(delta) {
    const boxes = this.nearbyContainers(5 + this.velocity.length() * delta);
    const radius = this.playerRadius;
    const height = this.playerHeight;
    const skin = 0.02;

    this.position.x += this.velocity.x * delta;
    this.resolveWalkAxis("x", boxes, radius, height, skin);
    this.position.z += this.velocity.z * delta;
    this.resolveWalkAxis("z", boxes, radius, height, skin);

    if (!this.grounded) {
      this.position.y += this.velocity.y * delta;
      this.resolveWalkCeiling(boxes, radius, height, skin);
    }

    this.snapToWalkFloor(boxes, radius, skin);
  }

  walkBodyOverlaps(box, radius, height) {
    const feet = this.position.y;
    const head = feet + height;
    // Standing on the roof is not a wall hit.
    if (feet >= box.maxY - 0.08) return false;
    return (
      this.position.x + radius > box.minX &&
      this.position.x - radius < box.maxX &&
      this.position.z + radius > box.minZ &&
      this.position.z - radius < box.maxZ &&
      head > box.minY + 0.02 &&
      feet < box.maxY - 0.02
    );
  }

  resolveWalkAxis(axis, boxes, radius, height, skin) {
    for (const box of boxes) {
      if (!this.walkBodyOverlaps(box, radius, height)) continue;
      const min = axis === "x" ? box.minX : box.minZ;
      const max = axis === "x" ? box.maxX : box.maxZ;
      const pos = this.position[axis];
      const pushPos = max + radius + skin - pos;
      const pushNeg = min - radius - skin - pos;
      this.position[axis] += Math.abs(pushPos) < Math.abs(pushNeg) ? pushPos : pushNeg;
      this.velocity[axis] = 0;
    }
  }

  resolveWalkCeiling(boxes, radius, height, skin) {
    const head = this.position.y + height;
    for (const box of boxes) {
      if (!this.overBox(box, radius * 0.35)) continue;
      if (this.position.y >= box.minY) continue;
      if (head > box.minY - skin) {
        this.position.y = box.minY - height - skin;
        if (this.velocity.y > 0) this.velocity.y = 0;
      }
    }
  }

  snapToWalkFloor(boxes, radius, skin) {
    const rising = !this.grounded && this.velocity.y > 0.4;
    const stepUp = rising ? 0.12 : 0.45;
    const stepDown = rising ? -0.01 : (this.grounded ? 0.55 : Math.max(0.2, -this.velocity.y * 0.05 + 0.15));
    let floor = null;
    for (const box of boxes) {
      if (!this.overBox(box, radius * 0.15)) continue;
      const gap = this.position.y - box.maxY;
      // Keep contact if you are on the roof, or have only sunk a little into it.
      if (gap > stepDown || gap < -stepUp) continue;
      if (!floor || box.maxY > floor) floor = box.maxY;
    }

    if (floor == null) {
      this.grounded = false;
      this.floorY = null;
      return;
    }

    this.position.y = floor + skin;
    this.velocity.y = 0;
    this.grounded = true;
    this.floorY = floor;
  }

  containerBoxes() {
    const boxes = [];
    const objects = this.worldSystem?.objects;
    if (!objects) return boxes;
    const hx = BLOCK_SIZE.x / 2;
    const hy = BLOCK_SIZE.y / 2;
    const hz = BLOCK_SIZE.z / 2;
    objects.forEach((obj) => {
      if (!obj.isBuildBlock || !obj.mesh) return;
      const p = obj.mesh.position;
      boxes.push({
        minX: p.x - hx,
        maxX: p.x + hx,
        minY: p.y - hy,
        maxY: p.y + hy,
        minZ: p.z - hz,
        maxZ: p.z + hz,
      });
    });
    return boxes;
  }

  overBox(box, inset) {
    return (
      this.position.x + inset > box.minX &&
      this.position.x - inset < box.maxX &&
      this.position.z + inset > box.minZ &&
      this.position.z - inset < box.maxZ
    );
  }

  collisionSpheres() {
    const spheres = [
      { y: 0.62, r: 0.62 },
      { y: 1.15, r: 0.58 },
      { y: 1.72, r: 0.5 },
    ];
    if (!this.gravityOn) {
      const eye = new THREE.Vector3(0, 1.45, 0).applyQuaternion(this.quaternion);
      spheres.push({ y: eye.y, x: eye.x, z: eye.z, r: 0.4 });
    }
    return spheres;
  }

  spherePush(center, radius, box) {
    const cx = Math.max(box.minX, Math.min(box.maxX, center.x));
    const cy = Math.max(box.minY, Math.min(box.maxY, center.y));
    const cz = Math.max(box.minZ, Math.min(box.maxZ, center.z));
    let dx = center.x - cx;
    let dy = center.y - cy;
    let dz = center.z - cz;
    const distSq = dx * dx + dy * dy + dz * dz;
    const skin = 0.06;
    if (distSq > 1e-8) {
      if (distSq >= radius * radius) return null;
      const dist = Math.sqrt(distSq);
      const scale = (radius + skin - dist) / dist;
      return new THREE.Vector3(dx * scale, dy * scale, dz * scale);
    }

    // Center is inside the container. Leave through the nearest face, including the underside.
    const faces = [
      { d: center.x - box.minX, x: -1, y: 0, z: 0 },
      { d: box.maxX - center.x, x: 1, y: 0, z: 0 },
      { d: center.y - box.minY, x: 0, y: -1, z: 0 },
      { d: box.maxY - center.y, x: 0, y: 1, z: 0 },
      { d: center.z - box.minZ, x: 0, y: 0, z: -1 },
      { d: box.maxZ - center.z, x: 0, y: 0, z: 1 },
    ];
    faces.sort((a, b) => a.d - b.d);
    const face = faces[0];
    const out = face.d + radius + skin;
    return new THREE.Vector3(face.x * out, face.y * out, face.z * out);
  }

  deflectFromSurface(push) {
    const len = push.length();
    if (len < 1e-8) return;
    const nx = push.x / len;
    const ny = push.y / len;
    const nz = push.z / len;
    const into = this.velocity.x * nx + this.velocity.y * ny + this.velocity.z * nz;
    if (into < 0) {
      this.velocity.x -= nx * into;
      this.velocity.y -= ny * into;
      this.velocity.z -= nz * into;
    }
    if (this.gravityOn && ny > 0.55 && this.velocity.y <= 0.5) {
      this.grounded = true;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }
  }

  pushOutOfContainers(boxes) {
    const spheres = this.collisionSpheres();
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const sphere of spheres) {
        const center = new THREE.Vector3(
          this.position.x + (sphere.x || 0),
          this.position.y + sphere.y,
          this.position.z + (sphere.z || 0)
        );
        for (const box of boxes) {
          const push = this.spherePush(center, sphere.r, box);
          if (!push) continue;
          this.position.add(push);
          center.add(push);
          this.deflectFromSurface(push);
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  nearbyContainers(reach) {
    const boxes = this.containerBoxes();
    const x = this.position.x;
    const y = this.position.y;
    const z = this.position.z;
    return boxes.filter((box) => (
      x + reach > box.minX &&
      x - reach < box.maxX &&
      y + reach + 2.4 > box.minY &&
      y - reach < box.maxY &&
      z + reach > box.minZ &&
      z - reach < box.maxZ
    ));
  }

  slideAgainstContainers(delta) {
    const reach = 4 + this.velocity.length() * delta;
    const boxes = this.nearbyContainers(reach);
    if (!boxes.length) {
      this.position.addScaledVector(this.velocity, delta);
      return;
    }

    this.pushOutOfContainers(boxes);
    const motion = this.velocity.clone().multiplyScalar(delta);
    const steps = Math.max(1, Math.ceil(motion.length() / 0.2));
    motion.multiplyScalar(1 / steps);
    for (let i = 0; i < steps; i++) {
      this.position.add(motion);
      this.pushOutOfContainers(boxes);
    }
  }

  placeOnContainer() {
    const boxes = this.containerBoxes();
    let roof = null;
    for (const box of boxes) {
      if (!this.overBox(box, 0.2)) continue;
      const gap = this.position.y - box.maxY;
      const inside = gap < 0 && gap > -BLOCK_SIZE.y;
      const closeAbove = gap >= -0.2 && gap <= 14;
      if (!inside && !closeAbove) continue;
      if (!roof || box.maxY > roof.maxY) roof = box;
    }
    if (!roof) return;
    this.position.y = roof.maxY + 0.02;
    this.grounded = true;
    this.floorY = roof.maxY;
    this.velocity.set(0, 0, 0);
  }

  updateCamera() {
    if (this.drivingCar) {
      const delta = Math.min(0.05, this._lastDelta || 0.016);
      this.vehicleSystem?.updateDriveCamera(this.camera, this, delta);
      return;
    }

    const targetBob = this.gravityOn && this.grounded && this.walkTime > 0.2
      ? Math.sin(this.walkTime) * 0.018
      : 0;
    this.eyeBob += (targetBob - this.eyeBob) * 0.2;

    let eyePos;
    if (this.gravityOn) {
      eyePos = this.position.clone();
      eyePos.y += 1.45 + this.eyeBob;
    } else {
      const eyeOffset = new THREE.Vector3(0, 1.45, 0).applyQuaternion(this.quaternion);
      eyePos = this.position.clone().add(eyeOffset);
    }
    this.camera.position.copy(eyePos);

    const lookTarget = eyePos.clone().add(
      new THREE.Vector3(0, 0, -20.0).applyQuaternion(this.quaternion)
    );
    this.camera.lookAt(lookTarget);
  }

  parseColor(color, defaultColor = 0x00f0ff) {
    if (typeof color === "number") return color;
    if (typeof color === "string") {
      const clean = color.replace("#", "0x");
      const parsed = parseInt(clean, 16);
      if (!isNaN(parsed)) return parsed;
    }
    return defaultColor;
  }

  /**
   * Adds or updates a remote player avatar in the space.
   */
  addOrUpdateRemotePlayer(sessionId, data) {
    let remote = this.remotePlayers.get(sessionId);

    const characterType = data.characterType || "astronaut";
    const colorHex = this.parseColor(data.color, 0xff0055);
    const avatarUrl = data.avatarUrl || "";

    if (!remote) {
      // Create remote avatar based on character type and accent color
      const mesh = this.createCharacterMesh(characterType, colorHex);
      mesh.userData.playerId = sessionId;

      const pilotName = data.name || `Pilot-${sessionId.slice(0, 4)}`;

      // Create holographic nametag + health billboard above character
      const nametagSprite = this.createNametagSprite(pilotName, data.health || 100, false);
      nametagSprite.position.set(0, 3.4, 0);
      mesh.add(nametagSprite);

      this.scene.add(mesh);

      remote = {
        mesh,
        characterType,
        colorHex,
        avatarUrl,
        targetPos: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
        targetRot: data.rotation || 0,
        targetPitch: data.pitch || 0,
        health: data.health || 100,
        name: pilotName,
        nametagSprite,
        driving: !!data.driving,
      };

      mesh.position.copy(remote.targetPos);
      this.remotePlayers.set(sessionId, remote);
      if (remote.driving) this.vehicleSystem?.syncRemoteDriver(sessionId, remote, true);

      // If custom GLB model URL was provided, attempt asynchronous load
      if (avatarUrl && avatarUrl.trim()) {
        this.loadRemoteCustomAvatar(sessionId, avatarUrl.trim());
      }
    } else {
      // Check if remote character type or color changed
      if (
        (data.characterType && data.characterType !== remote.characterType) ||
        (data.color && colorHex !== remote.colorHex) ||
        (data.avatarUrl !== undefined && data.avatarUrl !== remote.avatarUrl)
      ) {
        this.updateRemoteCharacter(sessionId, data);
      }

      // Update target positions for smooth interpolation
      if (typeof data.x === "number") remote.targetPos.x = data.x;
      if (typeof data.y === "number") remote.targetPos.y = data.y;
      if (typeof data.z === "number") remote.targetPos.z = data.z;
      if (typeof data.rotation === "number") remote.targetRot = data.rotation;
      if (typeof data.pitch === "number") remote.targetPitch = data.pitch;

      const nameChanged = typeof data.name === "string" && data.name !== remote.name;
      const healthChanged = typeof data.health === "number" && data.health !== remote.health;

      if (nameChanged) remote.name = data.name;
      if (healthChanged) remote.health = data.health;

      if (nameChanged || healthChanged) {
        this.updateNametagSprite(remote.nametagSprite, remote.name, remote.health);
      }

      if (typeof data.driving === "boolean" && data.driving !== remote.driving) {
        remote.driving = data.driving;
        this.vehicleSystem?.syncRemoteDriver(sessionId, remote, remote.driving);
      }
    }
  }

  updateRemoteCharacter(sessionId, data) {
    const remote = this.remotePlayers.get(sessionId);
    if (!remote) return;

    if (data.characterType) remote.characterType = data.characterType;
    if (data.color) remote.colorHex = this.parseColor(data.color, remote.colorHex);
    if (data.avatarUrl !== undefined) remote.avatarUrl = data.avatarUrl;

    const currentPos = remote.mesh.position.clone();
    const currentQuat = remote.mesh.quaternion.clone();

    // Preserve children like nametag and positional audio
    const preservedChildren = [];
    remote.mesh.traverse((child) => {
      if (child === remote.nametagSprite || child.isPositionalAudio) {
        preservedChildren.push(child);
      }
    });
    preservedChildren.forEach((child) => remote.mesh.remove(child));

    this.scene.remove(remote.mesh);

    const newMesh = this.createCharacterMesh(remote.characterType, remote.colorHex);
    newMesh.userData.playerId = sessionId;
    newMesh.position.copy(currentPos);
    newMesh.quaternion.copy(currentQuat);

    preservedChildren.forEach((child) => newMesh.add(child));
    this.scene.add(newMesh);
    remote.mesh = newMesh;

    if (remote.avatarUrl && remote.avatarUrl.trim()) {
      this.loadRemoteCustomAvatar(sessionId, remote.avatarUrl.trim());
    }
  }

  loadRemoteCustomAvatar(sessionId, avatarUrl) {
    const apply = (model) => {
      const remote = this.remotePlayers.get(sessionId);
      if (!remote) return;
      model.userData.playerId = sessionId;
      const currentPos = remote.mesh.position.clone();
      const currentQuat = remote.mesh.quaternion.clone();
      const preservedChildren = [];
      remote.mesh.traverse((child) => {
        if (child === remote.nametagSprite || child.isPositionalAudio) {
          preservedChildren.push(child);
        }
      });
      preservedChildren.forEach((child) => remote.mesh.remove(child));
      this.scene.remove(remote.mesh);
      model.position.copy(currentPos);
      model.quaternion.copy(currentQuat);
      preservedChildren.forEach((child) => model.add(child));
      this.scene.add(model);
      remote.mesh = model;
    };

    if (isImageAvatar(avatarUrl)) {
      apply(createPixelCard(THREE, avatarUrl));
      return;
    }

    this.gltfLoader.load(
      avatarUrl,
      (gltf) => apply(mountCharacter(THREE, gltf)),
      undefined,
      (err) => {
        console.warn(`[PlayerSystem] Failed loading custom avatar for remote ${sessionId}:`, err);
      }
    );
  }

  removeRemotePlayer(sessionId) {
    const remote = this.remotePlayers.get(sessionId);
    if (remote) {
      if (remote.driveMesh) {
        this.scene.remove(remote.driveMesh);
        remote.driveMesh = null;
      }
      this.vehicleSystem?.syncRemoteDriver(sessionId, remote, false);
      this.scene.remove(remote.mesh);
      this.remotePlayers.delete(sessionId);
    }
  }

  updateRemotePlayers(delta) {
    const lerpFactor = Math.min(1.0, delta * 12.0);
    this.remotePlayers.forEach((remote) => {
      if (remote.driving && remote.driveMesh?.visible) {
        remote.driveMesh.position.lerp(remote.targetPos, lerpFactor);
        const yaw = remote.targetRot || 0;
        remote.driveMesh.rotation.y += (yaw - remote.driveMesh.rotation.y) * lerpFactor;
        remote.mesh.userData.animate?.(delta, this.camera);
        this.vehicleSystem?.updateRemoteCar(remote);
        return;
      }

      remote.mesh.position.lerp(remote.targetPos, lerpFactor);

      const targetQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(remote.targetPitch || 0, remote.targetRot || 0, 0, "YXZ")
      );
      remote.mesh.quaternion.slerp(targetQuat, lerpFactor);
      remote.mesh.userData.animate?.(delta, this.camera);
      this.vehicleSystem?.updateRemoteCar(remote);
    });
  }

  createNametagSprite(name = "Pilot", health = 100, isLocal = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 80;
    const texture = new THREE.CanvasTexture(canvas);

    this.drawNametag(canvas, name, health, isLocal);

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.6, 0.9, 1.0);
    sprite.userData = { canvas, texture, name, health, isLocal };
    return sprite;
  }

  updateNametagSprite(sprite, name, health) {
    if (!sprite || !sprite.userData) return;
    if (name !== undefined) sprite.userData.name = name;
    if (health !== undefined) sprite.userData.health = health;

    const { canvas, texture } = sprite.userData;
    this.drawNametag(canvas, sprite.userData.name, sprite.userData.health, sprite.userData.isLocal);
    texture.needsUpdate = true;
  }

  drawNametag(canvas, name, health, isLocal) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Holographic Backdrop Pill
    ctx.fillStyle = "rgba(6, 10, 20, 0.82)";
    ctx.strokeStyle = isLocal ? "rgba(0, 240, 255, 0.7)" : "rgba(255, 0, 85, 0.7)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 12);
    ctx.fill();
    ctx.stroke();

    // 2. Pilot Name
    ctx.font = "bold 22px 'JetBrains Mono', 'Orbitron', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isLocal ? "#00f0ff" : "#ff99bb";
    ctx.shadowColor = isLocal ? "rgba(0, 240, 255, 0.8)" : "rgba(255, 0, 85, 0.8)";
    ctx.shadowBlur = 8;
    ctx.fillText(name.toUpperCase(), w / 2, 26);
    ctx.shadowBlur = 0; // reset shadow

    // 3. Integrated Health Bar
    const barX = 20;
    const barY = 48;
    const barW = w - 40;
    const barH = 14;

    // Bar background
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Bar fill
    const pct = Math.max(0, Math.min(100, health)) / 100;
    const fillWidth = barW * pct;

    if (pct < 0.3) {
      ctx.fillStyle = "#ff0055"; // Danger red
    } else if (pct < 0.6) {
      ctx.fillStyle = "#ffaa00"; // Warning amber
    } else {
      ctx.fillStyle = isLocal ? "#00f0ff" : "#00ff88"; // Healthy
    }

    if (fillWidth > 0) {
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillWidth, barH, 4);
      ctx.fill();
    }
  }

  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    if (this.gravityOn) this.placeOnContainer();
    if (this.mesh) this.mesh.position.copy(this.position);
    this.camera.position.set(this.position.x, this.position.y + 3.5, this.position.z + 9.0);
  }
}
