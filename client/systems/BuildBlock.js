import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WorldObject } from "./WorldObject.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const CONTAINER_WIDTH = 6;
export const BLOCK_SIZE = {
  x: CONTAINER_WIDTH * PHI * PHI,
  y: CONTAINER_WIDTH * PHI,
  z: CONTAINER_WIDTH,
};

export function snapBlockPosition(x, y, z) {
  return {
    x: Math.round(x / BLOCK_SIZE.x) * BLOCK_SIZE.x,
    y: Math.round(y / BLOCK_SIZE.y) * BLOCK_SIZE.y,
    z: Math.round(z / BLOCK_SIZE.z) * BLOCK_SIZE.z,
  };
}

export function blockCellKey(x, y, z) {
  return `${x}|${y}|${z}`;
}

const LINK_FACES = {
  "+x": { pos: [1, 0, 0], rot: [0, Math.PI / 2, 0], size: [0.82, 0.72] },
  "-x": { pos: [-1, 0, 0], rot: [0, -Math.PI / 2, 0], size: [0.82, 0.72] },
  "+y": { pos: [0, 1, 0], rot: [-Math.PI / 2, 0, 0], size: [0.7, 0.7] },
  "-y": { pos: [0, -1, 0], rot: [Math.PI / 2, 0, 0], size: [0.7, 0.7] },
  "+z": { pos: [0, 0, 1], rot: [0, 0, 0], size: [0.82, 0.72] },
  "-z": { pos: [0, 0, -1], rot: [0, Math.PI, 0], size: [0.82, 0.72] },
};

export function faceFromNormal(normal) {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);
  if (ax >= ay && ax >= az) return normal.x >= 0 ? "+x" : "-x";
  if (ay >= az) return normal.y >= 0 ? "+y" : "-y";
  return normal.z >= 0 ? "+z" : "-z";
}

export function isLinkFace(face) {
  return !!LINK_FACES[face];
}

/**
 * A rectangular container block. Players shoot these and stack them into structures.
 */
export class BuildBlock extends WorldObject {
  constructor(data) {
    super(data.id, "Container");
    this.isBuildBlock = true;
    this.isDestructible = true;
    this.builderName = data.builderName || "Pilot";
    this.color = data.color || "#00f0ff";
    this.health = typeof data.health === "number" ? data.health : 40;
    this.radius = 10;
    this.createdAt = data.createdAt || Date.now();

    const pos = data.position || { x: 0, y: 0, z: 0 };
    const snapped = snapBlockPosition(pos.x, pos.y, pos.z);
    this.cellKey = blockCellKey(snapped.x, snapped.y, snapped.z);
    this.mesh.position.set(snapped.x, snapped.y, snapped.z);
    this.spawnAge = 0;
    this.spawned = false;
    this.mesh.scale.setScalar(0.15);

    this.tags = new Map();
    this.buildGeometry();
  }

  buildGeometry() {
    const color = new THREE.Color(this.color);
    const { x: w, y: h, z: d } = BLOCK_SIZE;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color: color.clone().multiplyScalar(0.35),
        metalness: 0.55,
        roughness: 0.42,
        emissive: color.clone().multiplyScalar(0.08),
      })
    );
    this.mesh.add(body);

    const trimMat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.7,
      roughness: 0.28,
      emissive: color.clone().multiplyScalar(0.25),
    });

    const rails = [];
    const rail = (sx, sy, sz, px, py, pz) => {
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      geo.translate(px, py, pz);
      rails.push(geo);
    };

    const t = 0.22;
    rail(w + 0.08, t, t, 0, h / 2, d / 2);
    rail(w + 0.08, t, t, 0, h / 2, -d / 2);
    rail(w + 0.08, t, t, 0, -h / 2, d / 2);
    rail(w + 0.08, t, t, 0, -h / 2, -d / 2);
    rail(t, h + 0.08, t, w / 2, 0, d / 2);
    rail(t, h + 0.08, t, -w / 2, 0, d / 2);
    rail(t, t, d + 0.08, w / 2, h / 2, 0);
    rail(t, t, d + 0.08, -w / 2, h / 2, 0);

    const ribCount = 9;
    for (let i = 1; i < ribCount; i++) {
      const x = -w / 2 + (i * w) / ribCount;
      rail(0.16, h * 0.9, 0.1, x, 0, d / 2 + 0.04);
      rail(0.16, h * 0.9, 0.1, x, 0, -d / 2 - 0.04);
      rail(0.16, 0.1, d * 0.86, x, h / 2 + 0.04, 0);
    }

    const doorX = w / 2 + 0.06;
    rail(0.1, h * 0.86, 0.12, doorX, 0, -d * 0.18);
    rail(0.1, h * 0.86, 0.12, doorX, 0, d * 0.18);
    rail(0.08, 0.12, d * 0.78, doorX, h * 0.28, 0);
    rail(0.08, 0.12, d * 0.78, doorX, -h * 0.28, 0);
    rail(0.1, h * 0.78, 0.1, doorX, 0, d / 2 - 0.18);
    rail(0.1, h * 0.78, 0.1, doorX, 0, -d / 2 + 0.18);

    const trim = new THREE.Mesh(mergeGeometries(rails), trimMat);
    rails.forEach((geo) => geo.dispose());
    this.mesh.add(trim);

    this.buildHealthBar();
    this.markHittable();
  }

  markHittable() {
    this.mesh.traverse((child) => {
      if (child.isMesh) child.userData.planetId = this.id;
    });
  }

  buildHealthBar() {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 48;
    this.barCanvas = canvas;
    this.drawHealthBar();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    this.barTexture = texture;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    sprite.position.set(0, BLOCK_SIZE.y / 2 + 1.6, 0);
    sprite.scale.set(5.2, 0.95, 1);
    sprite.visible = false;
    this.barSprite = sprite;
    this.healthVisibleUntil = 0;
    this.mesh.add(sprite);
  }

  setHealth(health) {
    this.health = Math.max(0, Math.min(40, health));
    this.drawHealthBar();
    if (this.barTexture) this.barTexture.needsUpdate = true;
    if (this.barSprite) this.barSprite.visible = true;
    this.healthVisibleUntil = performance.now() + 4000;
  }

  drawHealthBar() {
    const canvas = this.barCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(6, 10, 20, 0.82)";
    ctx.beginPath();
    ctx.roundRect(4, 8, w - 8, h - 16, 8);
    ctx.fill();

    const barX = 16;
    const barY = 16;
    const barW = w - 32;
    const barH = 16;
    const pct = Math.max(0, Math.min(40, this.health)) / 40;

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    if (pct < 0.3) ctx.fillStyle = "#ff0055";
    else if (pct < 0.6) ctx.fillStyle = "#ffaa00";
    else ctx.fillStyle = "#00ff88";

    if (pct > 0) {
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * pct, barH, 4);
      ctx.fill();
    }
  }

  setGraffiti(face, url, expiresAt, meta = null) {
    if (!isLinkFace(face) || !url) return;
    this.clearGraffiti(face);

    const spec = LINK_FACES[face];
    const { x: w, y: h, z: d } = BLOCK_SIZE;
    const along = face.includes("x") ? d : face.includes("y") ? w : w;
    const across = face.includes("y") ? d : h;
    const planeW = along * spec.size[0];
    const planeH = across * spec.size[1];
    const inset = 0.12;

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(planeW, planeH),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    mesh.position.set(
      spec.pos[0] * (face.includes("x") ? w / 2 + inset : 0),
      spec.pos[1] * (face.includes("y") ? h / 2 + inset : 0),
      spec.pos[2] * (face.includes("z") ? d / 2 + inset : 0)
    );
    mesh.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
    mesh.userData.graffitiUrl = url;
    mesh.userData.graffitiFace = face;
    mesh.userData.blockId = this.id;
    mesh.userData.graffitiKind = meta?.kind || "link";
    this.mesh.add(mesh);
    this.markHittable();

    const tag = { url, expiresAt, mesh, canvas, texture, shownSec: -1, meta };
    this.tags.set(face, tag);
    this.drawGraffiti(tag);
  }

  clearGraffiti(face) {
    const tag = this.tags?.get(face);
    if (!tag) return;
    if (tag.mesh?.userData) tag.mesh.userData.graffitiUrl = "";
    tag.url = "";
    this.mesh.remove(tag.mesh);
    tag.mesh.geometry?.dispose();
    tag.mesh.material?.map?.dispose();
    tag.mesh.material?.dispose();
    this.tags.delete(face);
    dropGraffitiAnchor(this.id, face);
  }

  drawGraffiti(tag) {
    const canvas = tag.canvas;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    if (tag.meta?.kind === "meeting") {
      this.drawMeetingTag(tag);
      return;
    }
    const left = Math.max(0, Math.ceil((tag.expiresAt - Date.now()) / 1000));
    tag.shownSec = left;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(18, 4, 28, 0.88)";
    ctx.beginPath();
    ctx.roundRect(16, 18, w - 32, h - 36, 28);
    ctx.fill();
    ctx.strokeStyle = "#ff2bd6";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = "#ff2bd6";
    ctx.font = "700 28px 'Orbitron', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("LINK TAG", 40, 64);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffd700";
    ctx.fillText(`${left}s`, w - 40, 64);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 26px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    const label = tag.url.length > 42 ? `${tag.url.slice(0, 42)}...` : tag.url;
    const words = label.split(/(?<=\/)/);
    let line = "";
    let y = 118;
    words.forEach((part) => {
      const next = line + part;
      if (next.length > 28 && line) {
        ctx.fillText(line, w / 2, y);
        y += 32;
        line = part;
      } else {
        line = next;
      }
    });
    if (line && y < 200) ctx.fillText(line, w / 2, y);

    ctx.fillStyle = "#7dd3fc";
    ctx.font = "700 22px 'JetBrains Mono', monospace";
    ctx.fillText("CLICK TO OPEN", w / 2, h - 36);
    tag.texture.needsUpdate = true;
  }

  drawMeetingTag(tag) {
    const canvas = tag.canvas;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const startsAt = Number(tag.meta.startsAt) || 0;
    const locked = startsAt > Date.now();
    tag.shownSec = `${Math.floor(startsAt / 60000)}:${locked}`;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(28, 18, 4, 0.92)";
    ctx.beginPath();
    ctx.roundRect(16, 18, w - 32, h - 36, 28);
    ctx.fill();
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = "#ffd700";
    ctx.font = "700 26px 'Orbitron', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("MEETING", 40, 62);
    ctx.textAlign = "right";
    ctx.fillStyle = locked ? "#ffaa00" : "#00ff88";
    ctx.font = "700 22px 'JetBrains Mono', monospace";
    ctx.fillText(locked ? "LOCKED" : "OPEN", w - 40, 60);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 28px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    const title = String(tag.meta.title || "Meeting");
    ctx.fillText(title.length > 22 ? `${title.slice(0, 22)}...` : title, w / 2, 118);

    const when = new Date(startsAt);
    const stamp = Number.isNaN(when.getTime())
      ? ""
      : when.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    ctx.fillStyle = "#ffe9a8";
    ctx.font = "700 24px 'JetBrains Mono', monospace";
    ctx.fillText(stamp, w / 2, 158);

    ctx.fillStyle = "#7dd3fc";
    ctx.font = "700 22px 'JetBrains Mono', monospace";
    ctx.fillText("CLICK TO ARRIVE", w / 2, h - 36);
    tag.texture.needsUpdate = true;
  }

  update(delta) {
    if (!this.spawned) {
      this.spawnAge += delta;
      const t = Math.min(1, this.spawnAge / 0.16);
      this.mesh.scale.setScalar(0.15 + 0.85 * t);
      if (t >= 1) this.spawned = true;
    }
    if (this.barSprite?.visible && performance.now() > this.healthVisibleUntil) {
      this.barSprite.visible = false;
    }
    if (!this.tags?.size) return;
    const now = Date.now();
    for (const [face, tag] of [...this.tags.entries()]) {
      if (tag.meta?.kind === "meeting") {
        const key = `${Math.floor((tag.meta.startsAt || 0) / 60000)}:${now < tag.meta.startsAt}`;
        if (key !== tag.shownSec) this.drawGraffiti(tag);
        continue;
      }
      if (now >= tag.expiresAt) {
        this.clearGraffiti(face);
        continue;
      }
      const sec = Math.ceil((tag.expiresAt - now) / 1000);
      if (sec !== tag.shownSec) this.drawGraffiti(tag);
    }
  }
}

export function graffitiMeshes(objects) {
  const meshes = [];
  objects?.forEach((obj) => {
    if (!obj.isBuildBlock || !obj.tags) return;
    obj.tags.forEach((tag) => {
      if (tag.mesh && tag.url && Date.now() < tag.expiresAt) meshes.push(tag.mesh);
    });
  });
  return meshes;
}

export function dropGraffitiAnchor(blockId, face) {
  const root = document.getElementById("graffiti-links");
  if (!root) return;
  [...root.children].forEach((link) => {
    if (link.dataset.blockId !== blockId || link.dataset.face !== face) return;
    link.href = "";
    link.textContent = "";
    link.remove();
  });
  if (!root.children.length) root.hidden = true;
}

export function updateGraffitiLinks(objects, camera) {
  const root = document.getElementById("graffiti-links");
  if (!root || !camera) return;
  const spots = [];
  objects?.forEach((obj) => {
    if (!obj.isBuildBlock || !obj.tags?.size) return;
    obj.mesh.updateMatrixWorld(true);
    obj.tags.forEach((tag, face) => {
      const expired = tag.meta?.kind !== "meeting" && Date.now() >= tag.expiresAt;
      if (!tag.mesh || !tag.url || expired) return;
      const center = tag.mesh.getWorldPosition(new THREE.Vector3());
      const facing = new THREE.Vector3(0, 0, 1).transformDirection(tag.mesh.matrixWorld);
      const toCam = camera.position.clone().sub(center);
      const dist = toCam.length();
      if (dist > 70 || dist < 5 || facing.dot(toCam.normalize()) < 0.35) return;
      const projected = center.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) return;
      const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
      const width = Math.max(150, Math.min(340, 2400 / dist));
      const height = Math.max(42, Math.min(78, 820 / dist));
      const left = x - width / 2;
      const top = y - height / 2;
      if (left > window.innerWidth || top > window.innerHeight || left + width < 0 || top + height < 0) return;
      spots.push({
        url: tag.url,
        label: tag.meta?.kind === "meeting" ? (tag.meta.title || "Meeting") : tag.url,
        meetId: tag.meta?.kind === "meeting" ? tag.meta.meetId : "",
        blockId: obj.id,
        face,
        left,
        top,
        width,
        height,
        dist,
      });
    });
  });
  spots.sort((a, b) => a.dist - b.dist);
  const shown = spots.slice(0, 6);
  while (root.children.length > shown.length) {
    const extra = root.lastChild;
    extra.href = "";
    extra.textContent = "";
    extra.remove();
  }
  shown.forEach((spot, i) => {
    let link = root.children[i];
    if (!link) {
      link = document.createElement("a");
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.addEventListener("click", (e) => {
        e.stopPropagation();
        if (link.dataset.meet && window.multiverseApp?.goToMeeting) {
          e.preventDefault();
          window.multiverseApp.goToMeeting(link.dataset.meet);
        }
      });
      root.appendChild(link);
    }
    link.href = spot.url;
    link.dataset.meet = spot.meetId || "";
    link.dataset.blockId = spot.blockId || "";
    link.dataset.face = spot.face || "";
    link.textContent = spot.label || spot.url;
    link.style.left = `${spot.left}px`;
    link.style.top = `${spot.top}px`;
    link.style.width = `${spot.width}px`;
    link.style.height = `${spot.height}px`;
  });
  root.hidden = shown.length === 0;
}
