import * as THREE from "three";
import { WorldObject } from "./WorldObject.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * CustomPlanet — A user-created celestial body in Multiverse Magic.
 * Supports any form: Terrestrial, Ringed Gas Giant, Crystal Prism,
 * Torus Ringworld, Cyber Sphere, Molten Core, Dyson Sphere, Cube World, or Custom 3D Model!
 */
export class CustomPlanet extends WorldObject {
  constructor(data) {
    super(data.id, data.name || "Unnamed World");

    this.builderId = data.builderId || "unknown";
    this.builderName = data.builderName || "Cosmic Architect";
    this.form = data.form || "terrestrial";
    this.radius = Math.max(12, Math.min(80, Number(data.radius) || 30));
    this.primaryColor = data.primaryColor || "#00f0ff";
    this.secondaryColor = data.secondaryColor || "#9d00ff";
    this.rings = data.rings || "single";
    this.moonsCount = Math.max(0, Math.min(4, Number(data.moons) || 1));
    this.hasAtmosphere = data.hasAtmosphere !== false;
    this.customModelUrl = data.customModelUrl || "";
    this.createdAt = data.createdAt || Date.now();
    this.health = typeof data.health === "number" ? data.health : 100;
    this.isDestructible = true;

    const pos = data.position || { x: 0, y: -50, z: -200 };
    this.targetPos = new THREE.Vector3(pos.x, pos.y, pos.z);

    this.orbitMoons = [];
    this.cloudsMesh = null;
    this.corePulseMesh = null;
    this.orbitRings = [];
    this.nametagSprite = null;
    this.wasInOrbit = false;

    this.buildGeometry();
  }

  buildGeometry() {
    this.mesh.position.copy(this.targetPos);

    const primaryHex = parseInt(this.primaryColor.replace("#", "0x"), 16);
    const secondaryHex = parseInt(this.secondaryColor.replace("#", "0x"), 16);

    switch (this.form) {
      case "ringed_giant":
      case "gas_giant":
        this.buildRingedGiant(primaryHex, secondaryHex);
        break;
      case "crystal_prism":
      case "crystal":
        this.buildCrystalPrism(primaryHex, secondaryHex);
        break;
      case "torus_world":
      case "donut":
        this.buildTorusWorld(primaryHex, secondaryHex);
        break;
      case "cyber_sphere":
      case "techno":
        this.buildCyberSphere(primaryHex, secondaryHex);
        break;
      case "molten_core":
      case "volcanic":
        this.buildMoltenCore(primaryHex, secondaryHex);
        break;
      case "dyson_sphere":
      case "dyson":
        this.buildDysonSphere(primaryHex, secondaryHex);
        break;
      case "cube_world":
      case "voxel":
        this.buildCubeWorld(primaryHex, secondaryHex);
        break;
      case "custom_model":
        if (this.customModelUrl) {
          this.buildCustomModel(primaryHex, secondaryHex);
        } else {
          this.buildTerrestrial(primaryHex, secondaryHex);
        }
        break;
      case "terrestrial":
      default:
        this.buildTerrestrial(primaryHex, secondaryHex);
        break;
    }

    // Optional Rings system
    if (this.rings !== "none") {
      this.buildRings(secondaryHex);
    }

    // Optional Orbiting Moons
    if (this.moonsCount > 0) {
      this.buildMoons(primaryHex, secondaryHex);
    }

    // Overhead 3D Holographic Nametag Billboard
    this.buildNametag();
    this.markHittable();
  }

  markHittable() {
    this.mesh.traverse((child) => {
      if (child.isMesh) child.userData.planetId = this.id;
    });
  }

  // 1. TERRESTRIAL (Earth-like / Continental with swirling clouds)
  buildTerrestrial(primaryHex, secondaryHex) {
    // Ocean / Planet Core
    const planetGeo = new THREE.SphereGeometry(this.radius, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      color: primaryHex,
      roughness: 0.65,
      metalness: 0.25,
      emissive: new THREE.Color(primaryHex).multiplyScalar(0.15),
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    this.mesh.add(planetMesh);

    // Continental Landmasses (outer crust with elevation)
    const crustGeo = new THREE.SphereGeometry(this.radius * 1.006, 24, 24);
    const crustMat = new THREE.MeshStandardMaterial({
      color: secondaryHex,
      roughness: 0.85,
      metalness: 0.1,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    this.mesh.add(new THREE.Mesh(crustGeo, crustMat));

    // Swirling Cloud Sphere
    const cloudGeo = new THREE.SphereGeometry(this.radius * 1.025, 32, 32);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.9,
    });
    this.cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.mesh.add(this.cloudsMesh);

    // Glowing Atmospheric Scatter Rim
    if (this.hasAtmosphere) {
      const atmoGeo = new THREE.SphereGeometry(this.radius * 1.08, 32, 32);
      const atmoMat = new THREE.MeshBasicMaterial({
        color: secondaryHex,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      });
      this.mesh.add(new THREE.Mesh(atmoGeo, atmoMat));
    }
  }

  // 2. RINGED GAS GIANT
  buildRingedGiant(primaryHex, secondaryHex) {
    const giantGeo = new THREE.SphereGeometry(this.radius, 36, 36);
    const giantMat = new THREE.MeshStandardMaterial({
      color: primaryHex,
      roughness: 0.5,
      metalness: 0.2,
      emissive: new THREE.Color(primaryHex).multiplyScalar(0.2),
    });
    const giantMesh = new THREE.Mesh(giantGeo, giantMat);
    this.mesh.add(giantMesh);

    // Atmospheric Colored Bands
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const bandGeo = new THREE.TorusGeometry(
        Math.sqrt(this.radius * this.radius - Math.pow(i * (this.radius / 4.5), 2)) * 1.008,
        this.radius * 0.04,
        8,
        36
      );
      bandGeo.rotateX(Math.PI / 2);
      const bandMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? secondaryHex : 0xffffff,
        roughness: 0.6,
        transparent: true,
        opacity: 0.45,
      });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = i * (this.radius / 4.5);
      this.mesh.add(band);
    }

    if (this.hasAtmosphere) {
      const atmoGeo = new THREE.SphereGeometry(this.radius * 1.1, 32, 32);
      const atmoMat = new THREE.MeshBasicMaterial({
        color: secondaryHex,
        transparent: true,
        opacity: 0.22,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      });
      this.mesh.add(new THREE.Mesh(atmoGeo, atmoMat));
    }
  }

  // 3. CRYSTALLINE PRISM WORLD
  buildCrystalPrism(primaryHex, secondaryHex) {
    // Faceted Icosahedron crystal exterior
    const crystalGeo = new THREE.IcosahedronGeometry(this.radius, 1);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: primaryHex,
      roughness: 0.15,
      metalness: 0.85,
      flatShading: true,
      transparent: true,
      opacity: 0.88,
    });
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    this.mesh.add(crystalMesh);

    // Glowing Inner Pulsing Core
    const coreGeo = new THREE.OctahedronGeometry(this.radius * 0.55, 1);
    const coreMat = new THREE.MeshBasicMaterial({
      color: secondaryHex,
      wireframe: false,
    });
    this.corePulseMesh = new THREE.Mesh(coreGeo, coreMat);
    this.mesh.add(this.corePulseMesh);

    // Orbiting faceted crystal satellites
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const shardGeo = new THREE.ConeGeometry(this.radius * 0.08, this.radius * 0.35, 4);
      const shard = new THREE.Mesh(shardGeo, crystalMat);
      shard.position.set(
        Math.cos(angle) * this.radius * 1.45,
        Math.sin(angle * 2) * this.radius * 0.25,
        Math.sin(angle) * this.radius * 1.45
      );
      shard.rotation.set(angle, 0, angle);
      this.mesh.add(shard);
    }
  }

  // 4. TORUS RINGWORLD (Donut Planet)
  buildTorusWorld(primaryHex, secondaryHex) {
    const tubeRadius = this.radius * 0.35;
    const torusGeo = new THREE.TorusGeometry(this.radius, tubeRadius, 24, 48);
    const torusMat = new THREE.MeshStandardMaterial({
      color: primaryHex,
      roughness: 0.45,
      metalness: 0.35,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI / 3;
    this.mesh.add(torus);

    // Magnetic Containment Rails crossing through the central hole
    const railGeo = new THREE.TorusGeometry(this.radius * 0.65, this.radius * 0.03, 8, 32);
    const railMat = new THREE.MeshBasicMaterial({ color: secondaryHex });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.rotation.y = Math.PI / 2;
    this.mesh.add(rail);

    // Central Singularity Beacon
    const beaconGeo = new THREE.SphereGeometry(this.radius * 0.18, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: secondaryHex });
    this.corePulseMesh = new THREE.Mesh(beaconGeo, beaconMat);
    this.mesh.add(this.corePulseMesh);
  }

  // 5. CYBER SPHERE (Mecha / Death Star)
  buildCyberSphere(primaryHex, secondaryHex) {
    // Dark alloy hull
    const hullGeo = new THREE.SphereGeometry(this.radius, 32, 32);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.3,
      metalness: 0.9,
    });
    this.mesh.add(new THREE.Mesh(hullGeo, hullMat));

    // Glowing Equatorial Laser Trench
    const trenchGeo = new THREE.CylinderGeometry(this.radius * 1.01, this.radius * 1.01, this.radius * 0.14, 36, 1, true);
    const trenchMat = new THREE.MeshBasicMaterial({
      color: secondaryHex,
      side: THREE.DoubleSide,
    });
    this.mesh.add(new THREE.Mesh(trenchGeo, trenchMat));

    // Hexagonal / Lattice Hull Armor Plating
    const armorGeo = new THREE.IcosahedronGeometry(this.radius * 1.008, 2);
    const armorMat = new THREE.MeshStandardMaterial({
      color: primaryHex,
      roughness: 0.4,
      metalness: 0.8,
      wireframe: true,
    });
    this.mesh.add(new THREE.Mesh(armorGeo, armorMat));

    // Orbital Laser Super-Dishes
    const dishGeo = new THREE.ConeGeometry(this.radius * 0.3, this.radius * 0.15, 16, 1, true);
    dishGeo.rotateX(Math.PI);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.9, roughness: 0.2 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0, this.radius * 0.65, this.radius * 0.65);
    dish.lookAt(0, this.radius * 1.5, this.radius * 1.5);
    this.mesh.add(dish);
  }

  // 6. MOLTEN CORE (Volcanic / Lava)
  buildMoltenCore(primaryHex, secondaryHex) {
    // Dark Basalt Crust with Emissive Lava
    const lavaGeo = new THREE.SphereGeometry(this.radius, 32, 32);
    const lavaMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.9,
      metalness: 0.1,
      emissive: primaryHex,
      emissiveIntensity: 0.65,
    });
    this.mesh.add(new THREE.Mesh(lavaGeo, lavaMat));

    // Fiery Magma Fissures
    const fissureGeo = new THREE.IcosahedronGeometry(this.radius * 1.012, 1);
    const fissureMat = new THREE.MeshBasicMaterial({
      color: secondaryHex,
      wireframe: true,
    });
    this.mesh.add(new THREE.Mesh(fissureGeo, fissureMat));

    // Fiery Heat Haze Atmosphere
    const hazeGeo = new THREE.SphereGeometry(this.radius * 1.12, 24, 24);
    const hazeMat = new THREE.MeshBasicMaterial({
      color: primaryHex,
      transparent: true,
      opacity: 0.28,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    this.mesh.add(new THREE.Mesh(hazeGeo, hazeMat));
  }

  // 7. DYSON SPHERE (Exposed Star Core in Orbit Cage)
  buildDysonSphere(primaryHex, secondaryHex) {
    // Blazing Core Star
    const starGeo = new THREE.SphereGeometry(this.radius * 0.5, 24, 24);
    const starMat = new THREE.MeshBasicMaterial({ color: primaryHex });
    this.corePulseMesh = new THREE.Mesh(starGeo, starMat);
    this.mesh.add(this.corePulseMesh);

    const starLight = new THREE.PointLight(primaryHex, 3.0, this.radius * 8);
    this.mesh.add(starLight);

    // Geodesic Titanium Cage
    const cageGeo = new THREE.IcosahedronGeometry(this.radius, 1);
    const cageMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: true,
    });
    this.mesh.add(new THREE.Mesh(cageGeo, cageMat));

    // Gyroscopic Orbit Rings
    [-0.3, 0, 0.3].forEach((angle, idx) => {
      const ringGeo = new THREE.TorusGeometry(this.radius * 1.02, this.radius * 0.025, 8, 36);
      ringGeo.rotateX(angle + (idx * Math.PI) / 3);
      const ringMat = new THREE.MeshBasicMaterial({ color: secondaryHex });
      this.mesh.add(new THREE.Mesh(ringGeo, ringMat));
    });
  }

  // 8. CUBIC WORLD (Cosmic Voxel / Space Cube)
  buildCubeWorld(primaryHex, secondaryHex) {
    const size = this.radius * 1.5;
    const boxGeo = new THREE.BoxGeometry(size, size, size);
    const boxMat = new THREE.MeshStandardMaterial({
      color: primaryHex,
      roughness: 0.5,
      metalness: 0.3,
    });
    this.mesh.add(new THREE.Mesh(boxGeo, boxMat));

    // Edge Frame Highlight
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: secondaryHex, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    this.mesh.add(wireframe);

    // Crater / Dome features on faces
    const domeGeo = new THREE.SphereGeometry(size * 0.2, 12, 12);
    const domeMat = new THREE.MeshStandardMaterial({ color: secondaryHex, roughness: 0.3 });
    [[0, size / 2, 0], [0, -size / 2, 0], [size / 2, 0, 0], [-size / 2, 0, 0]].forEach(([x, y, z]) => {
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.position.set(x, y, z);
      this.mesh.add(dome);
    });
  }

  // 9. CUSTOM 3D MODEL
  buildCustomModel(primaryHex, secondaryHex) {
    // Immediate proxy sphere while GLB loads
    const proxyGeo = new THREE.SphereGeometry(this.radius * 0.8, 16, 16);
    const proxyMat = new THREE.MeshBasicMaterial({ color: primaryHex, wireframe: true });
    const proxy = new THREE.Mesh(proxyGeo, proxyMat);
    this.mesh.add(proxy);

    const loader = new GLTFLoader();
    loader.load(
      this.customModelUrl,
      (gltf) => {
        this.mesh.remove(proxy);
        const model = gltf.scene;

        // Auto-scale model to fit planet radius
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = (this.radius * 2) / maxDim;
        model.scale.set(scale, scale, scale);

        this.mesh.add(model);
        this.markHittable();
      },
      undefined,
      (err) => {
        console.warn("[CustomPlanet] Failed to load GLB model, keeping proxy:", err);
      }
    );
  }

  // RINGS SYSTEM
  buildRings(secondaryHex) {
    if (this.rings === "single") {
      const ringGeo = new THREE.RingGeometry(this.radius * 1.35, this.radius * 2.1, 48);
      ringGeo.rotateX(Math.PI / 2.3);
      const ringMat = new THREE.MeshBasicMaterial({
        color: secondaryHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      this.mesh.add(ring);
    } else if (this.rings === "double") {
      [-1, 1].forEach((dir) => {
        const ringGeo = new THREE.RingGeometry(this.radius * 1.4, this.radius * 1.9, 48);
        ringGeo.rotateX(Math.PI / 2.5 * dir);
        ringGeo.rotateY(dir * 0.4);
        const ringMat = new THREE.MeshBasicMaterial({
          color: secondaryHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45,
        });
        this.mesh.add(new THREE.Mesh(ringGeo, ringMat));
      });
    } else if (this.rings === "asteroid_belt") {
      // 32 mini asteroid boulders in orbit
      for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        const dist = this.radius * (1.45 + (i % 3) * 0.25);
        const rockGeo = new THREE.DodecahedronGeometry(this.radius * 0.045 * (0.8 + Math.random() * 0.5));
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(
          Math.cos(angle) * dist,
          (Math.random() - 0.5) * this.radius * 0.15,
          Math.sin(angle) * dist
        );
        this.mesh.add(rock);
      }
    }
  }

  // ORBITING MOONS
  buildMoons(primaryHex, secondaryHex) {
    for (let i = 0; i < this.moonsCount; i++) {
      const moonPivot = new THREE.Group();
      this.mesh.add(moonPivot);

      const orbitDist = this.radius * (1.7 + i * 0.65);
      const moonRadius = this.radius * (0.14 + (i % 2) * 0.05);

      const moonGeo = new THREE.SphereGeometry(moonRadius, 14, 14);
      const moonMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? secondaryHex : primaryHex,
        roughness: 0.8,
      });
      const moonMesh = new THREE.Mesh(moonGeo, moonMat);
      moonMesh.position.set(orbitDist, 0, 0);
      moonPivot.add(moonMesh);

      // Subtle Orbit Trail Line
      const trailGeo = new THREE.RingGeometry(orbitDist - 0.2, orbitDist + 0.2, 48);
      trailGeo.rotateX(Math.PI / 2);
      const trailMat = new THREE.MeshBasicMaterial({
        color: secondaryHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.18,
      });
      moonPivot.add(new THREE.Mesh(trailGeo, trailMat));

      moonPivot.rotation.x = (i * 0.35) - 0.2;
      moonPivot.rotation.z = (i * 0.2);

      this.orbitMoons.push({
        pivot: moonPivot,
        speed: (0.15 + (0.2 / (i + 1))) * (i % 2 === 0 ? 1 : -1),
      });
    }
  }

  // 3D HOLOGRAPHIC NAMETAG + HEALTH BAR
  buildNametag() {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 168;
    this.nametagCanvas = canvas;
    this.drawNametag();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    this.nametagTexture = texture;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    this.nametagSprite = new THREE.Sprite(spriteMat);
    this.nametagSprite.position.set(0, this.radius * 1.45 + 14, 0);
    const width = this.radius * 1.8;
    this.nametagSprite.scale.set(width, width * (168 / 512), 1);
    this.mesh.add(this.nametagSprite);
  }

  setHealth(health) {
    this.health = Math.max(0, Math.min(100, health));
    this.drawNametag();
    if (this.nametagTexture) this.nametagTexture.needsUpdate = true;
  }

  drawNametag() {
    const canvas = this.nametagCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(5, 8, 17, 0.82)";
    ctx.roundRect(10, 10, w - 20, h - 20, 16);
    ctx.fill();
    ctx.strokeStyle = this.primaryColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "#00f0ff";
    ctx.font = "bold 32px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`🪐 ${this.name.toUpperCase()}`, w / 2, 48);

    ctx.fillStyle = "#e0f2fe";
    ctx.font = "18px 'JetBrains Mono', monospace";
    ctx.fillText(`FORGED BY: ${this.builderName}`, w / 2, 82);

    const barX = 36;
    const barY = 104;
    const barW = w - 72;
    const barH = 22;
    const pct = Math.max(0, Math.min(100, this.health)) / 100;

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();

    if (pct < 0.3) ctx.fillStyle = "#ff0055";
    else if (pct < 0.6) ctx.fillStyle = "#ffaa00";
    else ctx.fillStyle = "#00ff88";

    if (pct > 0) {
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * pct, barH, 6);
      ctx.fill();
    }
  }

  update(delta, time, playerPosition, playerSystem, audioSystem, overlay) {
    // 1. Planet self-rotation
    this.mesh.rotation.y += delta * 0.04;

    // 2. Swirling clouds
    if (this.cloudsMesh) {
      this.cloudsMesh.rotation.y += delta * 0.02;
    }

    // 3. Pulsing inner core (if crystal / dyson)
    if (this.corePulseMesh) {
      const scale = 1.0 + Math.sin(time * 2.5) * 0.08;
      this.corePulseMesh.scale.set(scale, scale, scale);
    }

    // 4. Orbiting moons
    this.orbitMoons.forEach((m) => {
      m.pivot.rotation.y += delta * m.speed;
    });

    // 5. Proximity Orbit Detection
    if (playerPosition) {
      const dist = playerPosition.distanceTo(this.mesh.position);
      const orbitThreshold = this.radius * 2.4;
      if (dist <= orbitThreshold && !this.wasInOrbit) {
        this.wasInOrbit = true;
        const banner = document.getElementById("jumpgate-proximity-banner");
        if (banner) {
          banner.innerHTML = `<span style="color:#00ff88;font-weight:700;">🪐 ENTERING ORBIT: ${this.name.toUpperCase()} // FORGED BY ${this.builderName}</span>`;
          banner.style.display = "block";
          setTimeout(() => {
            if (this.wasInOrbit) banner.style.display = "none";
          }, 4500);
        }
      } else if (dist > orbitThreshold && this.wasInOrbit) {
        this.wasInOrbit = false;
      }
    }
  }
}
