import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import colyseus from "colyseus";
import { Player, SpaceState } from "../schema/Player.js";

const { Room } = colyseus;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const PLANETS_FILE = path.join(DATA_DIR, "planets.json");
const BLOCKS_FILE = path.join(DATA_DIR, "blocks.json");
const PHI = (1 + Math.sqrt(5)) / 2;
const CONTAINER_WIDTH = 6;
const BLOCK_SIZE = {
  x: CONTAINER_WIDTH * PHI * PHI,
  y: CONTAINER_WIDTH * PHI,
  z: CONTAINER_WIDTH,
};
// Safety stop only. Normal building should never notice this.
const MAX_BLOCKS = 8000;

export class SpaceRoom extends Room {
  maxClients = 64;

  onCreate(options) {
    this.setState(new SpaceState());
    this.lastShootTimes = new Map(); // sessionId -> timestamp
    this.lastDamageTimes = new Map(); // sessionId -> timestamp
    this.planets = new Map(); // planetId -> planetData
    this.blocks = new Map(); // blockId -> blockData
    this.blockCells = new Map(); // "x|y|z" -> blockId
    this.lastPlaceTimes = new Map();
    this.lastPaintTimes = new Map();
    this.links = new Map();
    this.linkTimers = new Map();
    this.exiles = new Map();
    this.linkMs = 60000;
    this.loadPlanets();
    this.loadBlocks();

    console.log(`[SpaceRoom] Created room with id: ${this.roomId}`);

    // Movement message handler: throttled sync from clients
    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (typeof data.x === "number") player.x = data.x;
      if (typeof data.y === "number") player.y = data.y;
      if (typeof data.z === "number") player.z = data.z;
      if (typeof data.rotation === "number") player.rotation = data.rotation;
      if (typeof data.pitch === "number") player.pitch = data.pitch;
      if (typeof data.driving === "boolean") player.driving = data.driving;
      this.rememberExile(player);
    });

    // Shooting message handler with 500ms cooldown
    this.onMessage("shoot", (client, data) => {
      const now = Date.now();
      const lastShoot = this.lastShootTimes.get(client.sessionId) || 0;
      if (now - lastShoot < 500) {
        // Enforce 500ms shooting cooldown
        return;
      }
      this.lastShootTimes.set(client.sessionId, now);

      // Broadcast shot event to all players for visual & audio rendering
      this.broadcast("shot_fired", {
        shooterId: client.sessionId,
        origin: data.origin,
        direction: data.direction,
        targetId: data.targetId || null,
        hitPoint: data.hitPoint || null,
      });

      // If a valid target was hit in the raycast
      if (data.targetId && this.state.players.has(data.targetId)) {
        this.handleHit(client.sessionId, data.targetId);
      } else if (data.targetId && this.planets.has(data.targetId)) {
        this.handlePlanetHit(client.sessionId, data.targetId);
      } else if (data.targetId && this.blocks.has(data.targetId)) {
        this.handleBlockHit(client.sessionId, data.targetId);
      }
    });

    // Explicit hit handler (if client reports confirmed raycast hit)
    this.onMessage("hit", (client, data) => {
      if (data.targetId && this.state.players.has(data.targetId)) {
        this.handleHit(client.sessionId, data.targetId);
      }
    });

    // WebRTC peer-to-peer signaling message relay
    this.onMessage("signal", (client, data) => {
      if (!data || !data.to || !data.signal) return;
      const targetClient = this.clients.find((c) => c.sessionId === data.to);
      if (targetClient) {
        targetClient.send("signal", {
          from: client.sessionId,
          signal: data.signal,
        });
      }
    });

    // Chat / text message relay (for IRC-like atmosphere)
    this.onMessage("chat", (client, text) => {
      if (typeof text !== "string" || !text.trim()) return;
      const cleanText = text.slice(0, 200).trim();
      const player = this.state.players.get(client.sessionId);
      const senderName = player?.name || client.sessionId.slice(0, 6);
      this.broadcast("chat", {
        senderId: client.sessionId,
        senderName: senderName,
        text: cleanText,
        timestamp: Date.now(),
      });
    });

    // Dynamic username change handler
    this.onMessage("set_name", (client, name) => {
      if (typeof name !== "string" || !name.trim()) return;
      const player = this.state.players.get(client.sessionId);
      if (player) {
        const next = name.trim().slice(0, 18);
        const exile = this.exiles.get(player.name);
        if (exile) {
          this.exiles.delete(player.name);
          this.exiles.set(next, exile);
        }
        player.name = next;
        this.broadcast("name_changed", { id: client.sessionId, name: player.name });
      }
    });

    // Dynamic character morph / customization handler
    this.onMessage("set_character", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !data) return;

      if (typeof data.characterType === "string") player.characterType = data.characterType;
      if (typeof data.color === "string") player.color = data.color;
      if (typeof data.avatarUrl === "string") player.avatarUrl = data.avatarUrl;

      this.broadcast("character_changed", {
        id: client.sessionId,
        characterType: player.characterType,
        color: player.color,
        avatarUrl: player.avatarUrl,
      });
    });

    // Dynamic planet builder handler
    this.onMessage("build_planet", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      const builderName = player?.name || `Pilot-${client.sessionId.slice(0, 4)}`;

      const planetId = `planet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const planetData = {
        id: planetId,
        name: String(data.name || "New Planet").trim().slice(0, 24),
        builderId: client.sessionId,
        builderName: builderName,
        form: String(data.form || "terrestrial"),
        radius: Math.max(12, Math.min(80, Number(data.radius) || 30)),
        primaryColor: String(data.primaryColor || "#00f0ff"),
        secondaryColor: String(data.secondaryColor || "#9d00ff"),
        rings: String(data.rings || "single"),
        moons: Math.max(0, Math.min(4, Number(data.moons) || 1)),
        hasAtmosphere: data.hasAtmosphere !== false,
        customModelUrl: typeof data.customModelUrl === "string" ? data.customModelUrl.trim() : "",
        position: {
          x: Math.round(Number(data.position?.x) || 0),
          y: Math.round(Number(data.position?.y) || -40),
          z: Math.round(Number(data.position?.z) || -160),
        },
        createdAt: Date.now(),
        health: 100,
      };

      this.planets.set(planetId, planetData);
      this.savePlanets();

      console.log(`[SpaceRoom] Pilot [${builderName}] forged new planet: "${planetData.name}" (${planetData.form}) at (${planetData.position.x}, ${planetData.position.y}, ${planetData.position.z})`);

      // Broadcast new planet to all connected clients
      this.broadcast("planet_created", planetData);

      // System chat broadcast
      this.broadcast("chat", {
        senderId: "COSMOS",
        senderName: "🪐 COSMOS",
        text: `Pilot [${builderName}] forged a new world: "${planetData.name}" [${planetData.form.toUpperCase()}]!`,
        timestamp: Date.now(),
      });
    });

    // Block gun: shoot a rectangular container that snaps onto the build grid.
    this.onMessage("place_block", (client, data) => {
      const now = Date.now();
      const lastPlace = this.lastPlaceTimes.get(client.sessionId) || 0;
      if (now - lastPlace < 400) return;
      this.lastPlaceTimes.set(client.sessionId, now);

      const shooter = this.state.players.get(client.sessionId);
      if (!shooter || !data) return;
      if (this.blocks.size >= MAX_BLOCKS) {
        client.send("block_rejected", { reason: "The sector can't hold any more containers." });
        return;
      }

      const rawX = Number(data.x);
      const rawY = Number(data.y);
      const rawZ = Number(data.z);
      if (![rawX, rawY, rawZ].every(Number.isFinite)) return;

      const snapped = this.snapBlock(rawX, rawY, rawZ);
      const dx = snapped.x - shooter.x;
      const dy = snapped.y - shooter.y;
      const dz = snapped.z - shooter.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > 90 * 90) {
        client.send("block_rejected", { reason: "That spot is out of range." });
        return;
      }
      if (distSq < 6 * 6) {
        client.send("block_rejected", { reason: "Too close to place a container." });
        return;
      }

      const cell = this.blockCellKey(snapped.x, snapped.y, snapped.z);
      if (this.blockCells.has(cell)) {
        client.send("block_rejected", { reason: "That spot already has a container." });
        return;
      }

      let color = String(data.color || "#00f0ff");
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = "#00f0ff";

      const blockId = `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const block = {
        id: blockId,
        builderId: client.sessionId,
        builderName: shooter.name || `Pilot-${client.sessionId.slice(0, 4)}`,
        color,
        health: 40,
        position: snapped,
        createdAt: now,
      };

      this.blocks.set(blockId, block);
      this.blockCells.set(cell, blockId);
      this.scheduleSaveBlocks();
      this.broadcast("block_placed", block);
    });

    // Delete planet handler (if builder chooses)
    this.onMessage("delete_planet", (client, data) => {
      if (!data || !data.id) return;
      const planet = this.planets.get(data.id);
      if (planet && (planet.builderId === client.sessionId || client.sessionId === "admin")) {
        this.planets.delete(data.id);
        this.savePlanets();
        this.broadcast("planet_deleted", { id: data.id });
      }
    });

    this.onMessage("schedule_meeting", (client, data) => {
      const now = Date.now();
      const lastPaint = this.lastPaintTimes.get(client.sessionId) || 0;
      if (now - lastPaint < 400) return;
      this.lastPaintTimes.set(client.sessionId, now);

      const shooter = this.state.players.get(client.sessionId);
      if (!shooter || !data) return;
      const block = this.blocks.get(data.blockId);
      if (!block) {
        client.send("meeting_rejected", { reason: "That container is gone." });
        return;
      }

      const faces = new Set(["+x", "-x", "+y", "-y", "+z", "-z"]);
      const face = String(data.face || "");
      if (!faces.has(face)) return;

      const startsAt = Number(data.startsAt);
      const fiveDays = 5 * 24 * 60 * 60 * 1000;
      if (!Number.isFinite(startsAt) || startsAt < now - 60 * 1000) {
        client.send("meeting_rejected", { reason: "That meeting time has already passed." });
        return;
      }
      if (startsAt > now + fiveDays) {
        client.send("meeting_rejected", { reason: "Meetings can only be booked up to 5 days ahead." });
        return;
      }

      const dx = (block.position?.x || 0) - shooter.x;
      const dy = (block.position?.y || 0) - shooter.y;
      const dz = (block.position?.z || 0) - shooter.z;
      if (dx * dx + dy * dy + dz * dz > 90 * 90) {
        client.send("meeting_rejected", { reason: "That container is out of range." });
        return;
      }

      let title = String(data.title || "Meeting").trim().slice(0, 40);
      if (!title) title = "Meeting";
      const id = block.meeting?.id || `meet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      block.meeting = {
        id,
        title,
        startsAt,
        face,
        host: shooter.name || `Pilot-${client.sessionId.slice(0, 4)}`,
      };
      this.clearLink(`${block.id}|${face}`, true);
      this.scheduleSaveBlocks();
      this.broadcast("meeting_scheduled", {
        id,
        title,
        startsAt,
        face,
        blockId: block.id,
        host: block.meeting.host,
        hostId: client.sessionId,
      });
    });

    this.onMessage("meet_goto", (client, data) => {
      const spot = this.meetingArrival(data?.id);
      if (!spot) {
        client.send("meet_missing", { id: data?.id || "" });
        return;
      }
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.x = spot.x;
        player.y = spot.y;
        player.z = spot.z;
      }
      client.send("meet_arrived", spot);
    });

    this.onMessage("paint_link", (client, data) => {
      const now = Date.now();
      const lastPaint = this.lastPaintTimes.get(client.sessionId) || 0;
      if (now - lastPaint < 400) return;
      this.lastPaintTimes.set(client.sessionId, now);

      const shooter = this.state.players.get(client.sessionId);
      if (!shooter || !data) return;
      const block = this.blocks.get(data.blockId);
      if (!block) {
        client.send("link_rejected", { reason: "That container is gone." });
        return;
      }

      const faces = new Set(["+x", "-x", "+y", "-y", "+z", "-z"]);
      const face = String(data.face || "");
      if (!faces.has(face)) return;
      if (block.meeting?.face === face && block.meeting.startsAt > Date.now()) {
        client.send("link_rejected", { reason: "That face is booked for a meeting." });
        return;
      }

      let url = String(data.url || "").trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) url = `https://${url}`;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          client.send("link_rejected", { reason: "That doesn't look like a link." });
          return;
        }
        url = parsed.toString();
      } catch (_) {
        client.send("link_rejected", { reason: "That doesn't look like a link." });
        return;
      }
      if (url.length > 500) {
        client.send("link_rejected", { reason: "That link is too long." });
        return;
      }

      const dx = (block.position?.x || 0) - shooter.x;
      const dy = (block.position?.y || 0) - shooter.y;
      const dz = (block.position?.z || 0) - shooter.z;
      if (dx * dx + dy * dy + dz * dz > 90 * 90) {
        client.send("link_rejected", { reason: "That container is out of range." });
        return;
      }

      const id = `${data.blockId}|${face}`;
      if (this.links.size >= 200 && !this.links.has(id)) {
        client.send("link_rejected", { reason: "Too many tags in this sector." });
        return;
      }

      const link = {
        id,
        blockId: data.blockId,
        face,
        url,
        paintedBy: shooter.name || `Pilot-${client.sessionId.slice(0, 4)}`,
        expiresAt: now + this.linkMs,
      };
      this.links.set(id, link);
      this.scheduleLinkClear(id);
      this.broadcast("link_painted", link);
    });

    // Health regeneration loop: +1 HP per second when not taking damage
    this.clock.setInterval(() => {
      const now = Date.now();
      this.state.players.forEach((player, sessionId) => {
        const lastDamaged = this.lastDamageTimes.get(sessionId) || 0;
        // Regenerate after 3 seconds of peace
        if (now - lastDamaged >= 3000 && player.health < 100 && player.health > 0) {
          player.health = Math.min(100, player.health + 1);
        }
      });
    }, 1000);
  }

  handleHit(shooterId, targetId) {
    const target = this.state.players.get(targetId);
    const shooter = this.state.players.get(shooterId);
    if (!target || !shooter) return;

    const now = Date.now();

    // Invulnerability right after ejection
    if (this.lastEjectionTimes && now - (this.lastEjectionTimes.get(targetId) || 0) < 3000) {
      return;
    }

    // Maximum laser combat range: 300 units
    const dx = target.x - shooter.x;
    const dy = target.y - shooter.y;
    const dz = target.z - shooter.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > 300 * 300) {
      return;
    }

    this.lastDamageTimes.set(targetId, now);

    // Decrement health by 10 per hit
    target.health = Math.max(0, target.health - 10);

    // Broadcast damage event to all clients
    this.broadcast("player_hit", {
      shooterId,
      targetId,
      damage: 10,
      health: target.health,
    });

    // Check for ejection threshold (health <= 0)
    if (target.health <= 0) {
      this.ejectPlayer(targetId, shooterId);
    }
  }

  handlePlanetHit(shooterId, planetId) {
    const planet = this.planets.get(planetId);
    const shooter = this.state.players.get(shooterId);
    if (!planet || !shooter) return;
    if (typeof planet.health !== "number") planet.health = 100;
    if (planet.health <= 0) return;

    const radius = Math.max(12, Math.min(80, Number(planet.radius) || 30));
    const dx = (planet.position?.x || 0) - shooter.x;
    const dy = (planet.position?.y || 0) - shooter.y;
    const dz = (planet.position?.z || 0) - shooter.z;
    // Rings and moons sit outside the core, so allow shots out to the outer orbit.
    const maxRange = 300 + radius * 2.2;
    if (dx * dx + dy * dy + dz * dz > maxRange * maxRange) return;

    planet.health = Math.max(0, planet.health - 10);
    this.broadcast("planet_damaged", {
      id: planetId,
      shooterId,
      damage: 10,
      health: planet.health,
    });

    if (planet.health > 0) {
      this.savePlanets();
      return;
    }

    const planetName = planet.name || "Unnamed World";
    const shooterName = shooter.name || `Pilot-${shooterId.slice(0, 4)}`;
    this.planets.delete(planetId);
    this.savePlanets();

    console.log(`[SpaceRoom] Pilot [${shooterName}] destroyed planet: "${planetName}"`);
    this.broadcast("planet_deleted", {
      id: planetId,
      destroyed: true,
      name: planetName,
      shooterName,
    });
    this.broadcast("chat", {
      senderId: "COSMOS",
      senderName: "🪐 COSMOS",
      text: `Pilot [${shooterName}] shattered the world "${planetName}"!`,
      timestamp: Date.now(),
    });
  }

  handleBlockHit(shooterId, blockId) {
    const block = this.blocks.get(blockId);
    const shooter = this.state.players.get(shooterId);
    if (!block || !shooter) return;
    if (typeof block.health !== "number") block.health = 40;
    if (block.health <= 0) return;
    if (block.meeting?.startsAt > Date.now()) {
      const booked = this.clients.find((c) => c.sessionId === shooterId);
      const when = new Date(block.meeting.startsAt).toUTCString();
      booked?.send("block_rejected", { reason: `Booked until the meeting: ${when}` });
      return;
    }

    const dx = (block.position?.x || 0) - shooter.x;
    const dy = (block.position?.y || 0) - shooter.y;
    const dz = (block.position?.z || 0) - shooter.z;
    if (dx * dx + dy * dy + dz * dz > 320 * 320) return;

    block.health = Math.max(0, block.health - 10);
    this.broadcast("block_damaged", {
      id: blockId,
      shooterId,
      damage: 10,
      health: block.health,
    });

    if (block.health > 0) {
      this.scheduleSaveBlocks();
      return;
    }

    const cell = this.blockCellKey(block.position.x, block.position.y, block.position.z);
    this.blocks.delete(blockId);
    this.blockCells.delete(cell);
    this.scheduleSaveBlocks();
    this.clearBlockLinks(blockId);
    this.broadcast("block_deleted", { id: blockId });
  }

  snapBlock(x, y, z) {
    return {
      x: Math.round(x / BLOCK_SIZE.x) * BLOCK_SIZE.x,
      y: Math.round(y / BLOCK_SIZE.y) * BLOCK_SIZE.y,
      z: Math.round(z / BLOCK_SIZE.z) * BLOCK_SIZE.z,
    };
  }

  blockCellKey(x, y, z) {
    return `${x}|${y}|${z}`;
  }

  ejectPlayer(targetId, shooterId) {
    const target = this.state.players.get(targetId);
    if (!target) return;

    if (!this.lastEjectionTimes) this.lastEjectionTimes = new Map();
    this.lastEjectionTimes.set(targetId, Date.now());

    const EJECTION_COORDS = { x: 10000, y: 10000, z: 10000 };

    // Teleport to deep space and restore health. A refresh does not skip the flight.
    target.x = EJECTION_COORDS.x;
    target.y = EJECTION_COORDS.y;
    target.z = EJECTION_COORDS.z;
    this.exiles.set(target.name, {
      x: EJECTION_COORDS.x,
      y: EJECTION_COORDS.y,
      z: EJECTION_COORDS.z,
      until: Date.now() + 25 * 60 * 1000,
    });
    target.health = 100;

    console.log(`[SpaceRoom] Player ${target.name || targetId} was ejected to deep space!`);

    // Broadcast ejection announcement to entire space
    this.broadcast("player_ejected", {
      targetId,
      shooterId,
      targetName: target.name || targetId.slice(0, 6),
      ejectionCoords: EJECTION_COORDS,
      message: `Pilot [${target.name || targetId.slice(0, 6)}] was ejected into deep space!`,
    });
  }

  onJoin(client, options = {}) {
    const pilotName =
      typeof options.name === "string" && options.name.trim()
        ? options.name.trim().slice(0, 18)
        : `Pilot-${client.sessionId.slice(0, 4)}`;

    console.log(`[SpaceRoom] Player joined: ${pilotName} (${client.sessionId})`);

    // Spawn player in a 30-unit neighborhood around origin
    const player = new Player();
    player.id = client.sessionId;
    player.name = pilotName;
    player.characterType = options.characterType || "wizard";
    player.color = options.color || "#9d00ff";
    player.avatarUrl = options.avatarUrl || "";
    const arrival = this.meetingArrival(options.meet);
    const exile = this.exiles.get(pilotName);
    const stillOut = exile && exile.until > Date.now();
    if (arrival) {
      this.exiles.delete(pilotName);
      player.x = arrival.x;
      player.y = arrival.y;
      player.z = arrival.z;
    } else if (stillOut) {
      player.x = exile.x;
      player.y = exile.y;
      player.z = exile.z;
    } else {
      player.x = (Math.random() - 0.5) * 30;
      player.y = (Math.random() - 0.5) * 10;
      player.z = (Math.random() - 0.5) * 30;
    }
    player.rotation = (Math.random() - 0.5) * Math.PI * 2;
    player.pitch = 0;
    player.health = 100;
    player.driving = false;

    this.state.players.set(client.sessionId, player);

    // Notify clients of new entrant
    this.broadcast(
      "player_joined",
      {
        id: client.sessionId,
        name: pilotName,
        characterType: player.characterType,
        color: player.color,
      },
      { except: client }
    );

    // Synchronize all persistent planets in the sector to the joining client
    client.send("planets_sync", Array.from(this.planets.values()));
    client.send("blocks_sync", Array.from(this.blocks.values()));
    client.send("links_sync", this.activeLinks());
    if (arrival) client.send("meet_arrived", arrival);
    else if (options.meet) client.send("meet_missing", { id: String(options.meet) });
    else if (stillOut) client.send("still_exiled", { x: exile.x, y: exile.y, z: exile.z });
  }

  rememberExile(player) {
    if (!player?.name || !this.exiles.has(player.name)) return;
    const dist = Math.hypot(player.x, player.y, player.z);
    if (dist < 380) {
      this.exiles.delete(player.name);
      return;
    }
    this.exiles.set(player.name, {
      x: player.x,
      y: player.y,
      z: player.z,
      until: Date.now() + 25 * 60 * 1000,
    });
  }

  meetingArrival(id) {
    const meetId = String(id || "").trim();
    if (!meetId) return null;
    for (const block of this.blocks.values()) {
      if (block.meeting?.id !== meetId || !block.position) continue;
      const halfLen = (CONTAINER_WIDTH * PHI * PHI) / 2;
      return {
        id: meetId,
        title: block.meeting.title,
        startsAt: block.meeting.startsAt,
        x: block.position.x + halfLen + 6,
        y: block.position.y + 3,
        z: block.position.z,
      };
    }
    return null;
  }

  activeLinks() {
    const now = Date.now();
    for (const id of [...this.links.keys()]) {
      const link = this.links.get(id);
      if (!link || now >= link.expiresAt) this.clearLink(id, false);
    }
    return [...this.links.values()];
  }

  scheduleLinkClear(id) {
    const existing = this.linkTimers.get(id);
    if (existing) existing.clear();
    const link = this.links.get(id);
    if (!link) return;
    const delay = Math.max(0, link.expiresAt - Date.now());
    const timer = this.clock.setTimeout(() => {
      this.linkTimers.delete(id);
      this.clearLink(id, true);
    }, delay);
    this.linkTimers.set(id, timer);
  }

  clearLink(id, broadcast = true) {
    const timer = this.linkTimers.get(id);
    if (timer) {
      timer.clear();
      this.linkTimers.delete(id);
    }
    const link = this.links.get(id);
    if (!link) return;
    const blockId = link.blockId;
    const face = link.face;
    link.url = "";
    this.links.delete(id);
    if (broadcast) this.broadcast("link_cleared", { id, blockId, face });
  }

  clearBlockLinks(blockId) {
    for (const id of [...this.links.keys()]) {
      if (this.links.get(id)?.blockId === blockId) this.clearLink(id, true);
    }
  }

  loadPlanets() {
    try {
      if (fs.existsSync(PLANETS_FILE)) {
        const raw = fs.readFileSync(PLANETS_FILE, "utf8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((p) => {
            if (!p || !p.id) return;
            if (typeof p.health !== "number") p.health = 100;
            this.planets.set(p.id, p);
          });
          console.log(`[SpaceRoom] Loaded ${this.planets.size} persistent planets from disk.`);
        }
      }
    } catch (err) {
      console.warn("[SpaceRoom] Error loading planets file:", err);
    }
  }

  loadBlocks() {
    try {
      if (!fs.existsSync(BLOCKS_FILE)) return;
      const list = JSON.parse(fs.readFileSync(BLOCKS_FILE, "utf8"));
      if (!Array.isArray(list)) return;
      list.forEach((block) => {
        if (!block || !block.id || !block.position) return;
        const snapped = this.snapBlock(block.position.x, block.position.y, block.position.z);
        block.position = snapped;
        if (typeof block.health !== "number") block.health = 40;
        const cell = this.blockCellKey(snapped.x, snapped.y, snapped.z);
        if (this.blockCells.has(cell)) return;
        this.blocks.set(block.id, block);
        this.blockCells.set(cell, block.id);
      });
      console.log(`[SpaceRoom] Loaded ${this.blocks.size} containers from ${BLOCKS_FILE}.`);
    } catch (err) {
      console.warn("[SpaceRoom] Error loading blocks file:", err);
    }
  }

  scheduleSaveBlocks() {
    if (this.blockSaveTimer) return;
    this.blockSaveTimer = setTimeout(() => {
      this.blockSaveTimer = null;
      this.saveBlocks();
    }, 1500);
  }

  saveBlocks() {
    try {
      const list = Array.from(this.blocks.values());
      const dir = path.dirname(BLOCKS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const payload = JSON.stringify(list, null, 2);
      const tmp = `${BLOCKS_FILE}.tmp`;
      fs.writeFileSync(tmp, payload, "utf8");
      fs.renameSync(tmp, BLOCKS_FILE);
    } catch (err) {
      console.warn("[SpaceRoom] Error saving blocks file:", err);
    }
  }

  savePlanets() {
    try {
      const list = Array.from(this.planets.values());
      const dir = path.dirname(PLANETS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(PLANETS_FILE, JSON.stringify(list, null, 2), "utf8");
    } catch (err) {
      console.warn("[SpaceRoom] Error saving planets file:", err);
    }
  }

  onLeave(client, consented) {
    console.log(`[SpaceRoom] Player left: ${client.sessionId}`);
    const player = this.state.players.get(client.sessionId);
    if (player) this.rememberExile(player);
    this.state.players.delete(client.sessionId);
    this.lastShootTimes.delete(client.sessionId);
    this.lastPlaceTimes.delete(client.sessionId);
    this.lastDamageTimes.delete(client.sessionId);

    this.broadcast("player_left", { id: client.sessionId });
  }

  onDispose() {
    if (this.blockSaveTimer) {
      clearTimeout(this.blockSaveTimer);
      this.blockSaveTimer = null;
    }
    this.saveBlocks();
    console.log(`[SpaceRoom] Room ${this.roomId} disposed. Saved ${this.blocks.size} containers.`);
  }
}
