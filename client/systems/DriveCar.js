import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { BLOCK_SIZE } from "./BuildBlock.js";

export const CAR_HALF = { x: 1.05, y: 0.55, z: 2.3 };

/**
 * High-detail vehicle fleet (showroom-grade, not low-poly):
 * - supercar: three.js Ferrari demo model (vicent091036)
 * - concept: Khronos CarConcept (CC-BY, from CC0 Unity Fan model)
 * - banger / rusty: detailed classic beaters
 * - tractor: detailed farm tractor
 */

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
loader.setDRACOLoader(draco);

const HANDLING = {
  supercar: {
    maxSpeed: 44, reverseMax: 16, accelForce: 52, brakeForce: 78, coastDrag: 1.05,
    frontGrip: 14, rearGrip: 11, handbrakeRearGrip: 0.55, steerPower: 3.1,
    seat: [-0.36, 1.08, 0.15],
  },
  concept: {
    maxSpeed: 40, reverseMax: 15, accelForce: 48, brakeForce: 72, coastDrag: 1.1,
    frontGrip: 13, rearGrip: 10.5, handbrakeRearGrip: 0.6, steerPower: 2.95,
    seat: [-0.34, 1.05, -0.05],
  },
  banger: {
    maxSpeed: 26, reverseMax: 11, accelForce: 32, brakeForce: 46, coastDrag: 1.55,
    frontGrip: 8.5, rearGrip: 7, handbrakeRearGrip: 1.0, steerPower: 2.45,
    // Solid meshes have no hollow cabin — sit on the dash looking out the nose.
    seat: [0, 1.18, -0.72],
    cabinExterior: true,
  },
  tractor: {
    maxSpeed: 13, reverseMax: 7, accelForce: 20, brakeForce: 34, coastDrag: 2.3,
    frontGrip: 12, rearGrip: 14, handbrakeRearGrip: 2.8, steerPower: 2.0,
    seat: [0, 1.9, -0.35],
    cabinExterior: true,
  },
};

const FLEET = [
  { id: "supercar", file: "supercar.glb", kind: "supercar", targetLen: 4.55, flipYaw: false },
  { id: "concept", file: "concept.glb", kind: "concept", targetLen: 4.6, flipYaw: true },
  { id: "banger", file: "banger.glb", kind: "banger", targetLen: 4.35, flipYaw: true },
  { id: "rusty", file: "rusty.glb", kind: "banger", targetLen: 3.9, flipYaw: true },
  { id: "tractor", file: "tractor.glb", kind: "tractor", targetLen: 3.8, flipYaw: true },
];

const PAINT = {
  supercar: [0xc41230, 0x1a1a1e, 0xf2f2f0, 0x1f4fd6, 0xd4af37, 0x0d7a4f, 0xff6a00, 0x7b2cbf],
  concept: [0xb11226, 0xc0c4cc, 0x2a2d34, 0x1a5fb4, 0xd4a017, 0xe8e8e8],
  banger: [0x6b5a45, 0x4a5560, 0x7a6e52, 0x8b4513, 0x5c4033, 0x708090, 0x3d4a3a, 0x9a7b4f],
  tractor: [0xc4a000, 0x2e7d32, 0xb71c1c, 0x1565c0, 0xf57c00, 0x33691e],
};

const templates = new Map();
let loadPromise = null;

function assetUrl(file) {
  return new URL(`../assets/models/cars/${file}`, import.meta.url).href;
}

function hashInt(seed) {
  let h = 0;
  const s = String(seed ?? "0");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function pickFleetEntry(seed) {
  const h = hashInt(seed);
  const roll = h % 100;
  let pool;
  if (roll < 18) pool = FLEET.filter((f) => f.kind === "tractor");
  else if (roll < 55) pool = FLEET.filter((f) => f.kind === "banger");
  else if (roll < 75) pool = FLEET.filter((f) => f.kind === "concept");
  else pool = FLEET.filter((f) => f.kind === "supercar");
  return pool[h % pool.length];
}

function pickPaint(kind, seed, overrideHex) {
  if (typeof overrideHex === "number" && !Number.isNaN(overrideHex)) {
    if (kind === "banger" || kind === "tractor") {
      const c = new THREE.Color(overrideHex);
      c.offsetHSL(0, -0.2, -0.1);
      return c.getHex();
    }
    return overrideHex;
  }
  const list = PAINT[kind] || PAINT.supercar;
  return list[hashInt(seed) % list.length];
}

export function preloadCarModels() {
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all(
    FLEET.map(async (entry) => {
      const gltf = await loader.loadAsync(assetUrl(entry.file));
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const axis = Math.max(size.z, size.x, 0.01);
      root.scale.setScalar(entry.targetLen / axis);
      root.updateMatrixWorld(true);
      templates.set(entry.id, { scene: root, entry });
    })
  ).catch((err) => console.warn("[DriveCar] Fleet preload failed:", err));
  return loadPromise;
}

preloadCarModels();

/** Strip shadow cards, blend planes, and bogus full-bright emissives. */
function scrubCarArtifacts(root) {
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const name = (o.name || "").toLowerCase();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];

    const looksLikeCard =
      name.includes("plane") ||
      name.includes("shadow") ||
      name.includes("_ao") ||
      name.includes("decal");
    const blendOnly =
      mats.length > 0 &&
      mats.every((m) => m && (m.transparent || m.opacity < 0.99 || m.alphaMode === "BLEND"));

    if (looksLikeCard || (blendOnly && name.includes("plane"))) {
      remove.push(o);
      return;
    }

    for (const m of mats) {
      if (!m) continue;
      if (m.emissive) {
        const e = m.emissive;
        // Sketchfab leftovers: emissive (1,1,1) washes the whole mesh.
        if (e.r >= 0.85 && e.g >= 0.85 && e.b >= 0.85) {
          m.emissive.setRGB(0, 0, 0);
          if ("emissiveIntensity" in m) m.emissiveIntensity = 0;
        }
      }
      if (m.transparent && (m.opacity ?? 1) >= 0.98 && !String(m.name || "").toLowerCase().includes("glass")) {
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
      }
      // Cut double-sided z-fighting on opaque body panels.
      if (!m.transparent) m.side = THREE.FrontSide;
    }
  });
  remove.forEach((o) => {
    o.parent?.remove(o);
    o.geometry?.dispose?.();
  });
}

function applyConceptMaterials(root, colorHex) {
  const paint = new THREE.Color(colorHex);
  const tailLit = new THREE.MeshStandardMaterial({
    color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.3,
  });
  const headLit = new THREE.MeshStandardMaterial({
    color: 0xfff5d6, emissive: 0xffe8a0, emissiveIntensity: 0.7, metalness: 0.2, roughness: 0.2,
  });
  const tailDim = new THREE.MeshStandardMaterial({
    color: 0x551018, emissive: 0x220808, emissiveIntensity: 0.15, metalness: 0.3, roughness: 0.4,
  });

  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const name = (o.name || "").toLowerCase();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const next = mats.map((mat) => {
      const n = `${name} ${mat.name || ""}`.toLowerCase();
      if (n.includes("glass") || n.includes("window") || n.includes("windshield")) {
        const g = mat.clone();
        g.transparent = true;
        g.depthWrite = false;
        if ("transmission" in g) g.transmission = Math.max(g.transmission || 0, 0.85);
        if ("opacity" in g) g.opacity = Math.min(g.opacity ?? 1, 0.35);
        if ("roughness" in g) g.roughness = 0.05;
        return g;
      }
      if (n.includes("paint")) {
        const m = mat.clone();
        if (m.color) m.color.copy(paint);
        if ("clearcoat" in m) {
          m.clearcoat = 1;
          m.clearcoatRoughness = 0.04;
        }
        if ("metalness" in m) m.metalness = Math.max(m.metalness ?? 0.5, 0.7);
        if ("envMapIntensity" in m) m.envMapIntensity = 1.3;
        m.side = THREE.FrontSide;
        return m;
      }
      if (n.includes("brakelight") || n.includes("taillight")) return tailDim.clone();
      if (n.includes("headlight")) return headLit.clone();
      const keep = mat.clone();
      if (keep.emissive && keep.emissive.r > 0.9 && keep.emissive.g > 0.9 && keep.emissive.b > 0.9) {
        keep.emissive.setRGB(0, 0, 0);
        keep.emissiveIntensity = 0;
      }
      return keep;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });

  return { bodyMaterial: null, tailLit, headLit, tailDim };
}

function applyTexturedBodyMaterials(root, colorHex, kind) {
  const paint = new THREE.Color(colorHex);
  const worn = kind === "banger";
  const tailLit = new THREE.MeshStandardMaterial({
    color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 0.5,
  });
  const headLit = new THREE.MeshStandardMaterial({
    color: 0xfff0c8, emissive: 0xffe08a, emissiveIntensity: 0.45,
  });
  const tailDim = new THREE.MeshStandardMaterial({
    color: 0x551018, emissive: 0x220808, emissiveIntensity: 0.12,
  });

  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const next = mats.map((mat) => {
      // Keep baked textures; only nudge hue so we don't flatten detail.
      const m = mat.clone();
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      if (m.color) {
        const base = m.color.clone();
        base.lerp(paint, worn ? 0.28 : 0.4);
        m.color.copy(base);
      }
      if (m.emissive) {
        const e = m.emissive;
        if (e.r >= 0.85 && e.g >= 0.85 && e.b >= 0.85) {
          m.emissive.setRGB(0, 0, 0);
          if ("emissiveIntensity" in m) m.emissiveIntensity = 0;
        }
      }
      m.transparent = false;
      m.opacity = 1;
      m.depthWrite = true;
      m.side = THREE.FrontSide;
      if ("metalness" in m) m.metalness = worn ? 0.3 : (m.metalness ?? 0.4);
      if ("roughness" in m) m.roughness = worn ? Math.max(m.roughness ?? 0.6, 0.65) : (m.roughness ?? 0.45);
      if ("envMapIntensity" in m) m.envMapIntensity = worn ? 0.75 : 1.0;
      return m;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });

  return { bodyMaterial: null, tailLit, headLit, tailDim };
}

function applySupercarMaterials(root, colorHex) {
  const paint = new THREE.Color(colorHex);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: paint, metalness: 1, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.35,
  });
  const detailsMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 1, roughness: 0.35, envMapIntensity: 1.2,
  });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0.25, roughness: 0, transmission: 1, transparent: true, opacity: 1,
  });
  const tailLit = new THREE.MeshStandardMaterial({
    color: 0xff1020, emissive: 0xff1020, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.35,
  });
  const headLit = new THREE.MeshStandardMaterial({
    color: 0xfff5d6, emissive: 0xffe8a0, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.25,
  });
  const tailDim = new THREE.MeshStandardMaterial({
    color: 0x661018, emissive: 0x330808, emissiveIntensity: 0.15, metalness: 0.4, roughness: 0.4,
  });

  const body = root.getObjectByName("body");
  if (body) body.material = bodyMaterial;
  ["rim_fl", "rim_fr", "rim_rr", "rim_rl", "trim", "chrome", "metal", "nuts"].forEach((name) => {
    root.traverse((o) => {
      if (o.name === name && o.isMesh) o.material = detailsMaterial;
    });
  });
  const glass = root.getObjectByName("glass");
  if (glass) glass.material = glassMaterial;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const n = (o.name || "").toLowerCase();
    if (n === "lights_red") o.material = tailLit.clone();
    if (n === "lights" || n === "leds") o.material = headLit.clone();
  });
  return { bodyMaterial, tailLit, headLit, tailDim };
}

function collectWheels(root) {
  const wheels = [];
  // Ferrari-style
  ["wheel_fl", "wheel_fr", "wheel_rl", "wheel_rr"].forEach((name) => {
    const w = root.getObjectByName(name);
    if (!w) return;
    w.userData.front = name.includes("_f");
    w.userData.restY = w.position.y;
    wheels.push(w);
  });
  if (wheels.length) return wheels;

  // CarConcept-style pivots
  ["WheelFrontL", "WheelFrontR", "WheelRearL", "WheelRearR"].forEach((name) => {
    const w = root.getObjectByName(name);
    if (!w) return;
    w.userData.front = name.includes("Front");
    w.userData.restY = w.position.y;
    wheels.push(w);
  });
  if (wheels.length) return wheels;

  // Kenney / generic hyphen names
  root.traverse((child) => {
    const name = (child.name || "").toLowerCase();
    if (!name.startsWith("wheel")) return;
    child.userData.front = name.includes("front");
    child.userData.restY = child.position.y;
    wheels.push(child);
  });
  return wheels;
}

export function createCarMesh(THREE_NS, colorHex = null, styleSeed = null) {
  const entry = pickFleetEntry(styleSeed);
  const cached = templates.get(entry.id);
  const paint = pickPaint(entry.kind, styleSeed, colorHex);

  if (!cached) {
    return createProceduralFallback(THREE_NS, paint, entry.kind);
  }

  const group = new THREE.Group();
  const lean = new THREE.Group();
  group.add(lean);

  const model = cached.scene.clone(true);
  if (entry.flipYaw) model.rotation.y = Math.PI;
  scrubCarArtifacts(model);

  let mats;
  if (entry.kind === "supercar") mats = applySupercarMaterials(model, paint);
  else if (entry.kind === "concept") mats = applyConceptMaterials(model, paint);
  else mats = applyTexturedBodyMaterials(model, paint, entry.kind);

  lean.add(model);
  const wheels = collectWheels(model);
  const lights_red = model.getObjectByName("lights_red") || model.getObjectByName("BodyTaillights");
  const lights = model.getObjectByName("lights") || model.getObjectByName("BodyHeadlights");
  const handling = { ...HANDLING[entry.kind] };

  group.userData.wheels = wheels;
  group.userData.body = lean;
  group.userData.model = model;
  group.userData.materials = mats;
  group.userData.handling = handling;
  group.userData.kind = entry.kind;
  group.userData.cabinExterior = !!handling.cabinExterior;
  group.userData.lights = {
    headL: lights,
    headR: lights,
    tailL: lights_red,
    tailR: lights_red,
    reverse: null,
    headOn: mats.headLit,
    headOff: mats.headLit,
    tailOn: mats.tailLit,
    tailDim: mats.tailDim,
  };
  group.userData.colorHex = paint;
  group.userData.style = entry.id;
  group.userData.ready = true;
  return group;
}

function createProceduralFallback(THREE_NS, colorHex, kind = "banger") {
  const group = new THREE_NS.Group();
  const lean = new THREE_NS.Group();
  group.add(lean);
  const mat = new THREE_NS.MeshPhysicalMaterial({
    color: colorHex,
    metalness: kind === "supercar" ? 0.9 : 0.4,
    roughness: kind === "banger" ? 0.75 : 0.35,
    clearcoat: kind === "banger" ? 0.2 : 0.8,
  });
  const h = kind === "tractor" ? 1.2 : 0.55;
  const body = new THREE_NS.Mesh(new THREE_NS.BoxGeometry(2, h, kind === "tractor" ? 3.2 : 4.2), mat);
  body.position.y = h * 0.9;
  lean.add(body);
  group.userData.wheels = [];
  group.userData.body = lean;
  group.userData.lights = null;
  group.userData.handling = { ...HANDLING[kind] || HANDLING.banger };
  group.userData.kind = kind;
  group.userData.colorHex = colorHex;
  group.userData.ready = true;
  return group;
}

export function carIdForBlock(blockId) {
  return `car_${blockId}`;
}

export function carStyleForBlock(blockId) {
  return pickFleetEntry(blockId).id;
}

export function roofSeatForBlock(block) {
  const p = block.mesh.position;
  return new THREE.Vector3(
    p.x,
    p.y + BLOCK_SIZE.y / 2 + CAR_HALF.y,
    p.z + Math.min(0.8, BLOCK_SIZE.z * 0.1)
  );
}

export function setCarLights(mesh, { braking = false, reverse = false, headlights = true } = {}) {
  const lights = mesh?.userData?.lights;
  const mats = mesh?.userData?.materials;
  if (!lights || !mats) return;

  if (lights.tailL?.isMesh) {
    lights.tailL.material = braking ? mats.tailLit : mats.tailDim;
    if (lights.tailL.material.emissiveIntensity != null) {
      lights.tailL.material.emissiveIntensity = braking ? 1.8 : 0.2;
    }
  }
  if (lights.headL?.isMesh && headlights) {
    lights.headL.material = mats.headLit;
    if (lights.headL.material.emissiveIntensity != null) {
      lights.headL.material.emissiveIntensity = 0.7;
    }
  }
  void reverse;
}
