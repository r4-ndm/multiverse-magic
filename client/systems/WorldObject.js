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

  update(delta, time) {
    this.objects.forEach((obj) => {
      obj.update(delta, time);
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
