import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import colyseus from "colyseus";
import { Player, SpaceState } from "../schema/Player.js";

const { Room } = colyseus;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLANETS_FILE = path.join(__dirname, "..", "data", "planets.json");

export class SpaceRoom extends Room {
  maxClients = 64;

  onCreate(options) {
    this.setState(new SpaceState());
    this.lastShootTimes = new Map(); // sessionId -> timestamp
    this.lastDamageTimes = new Map(); // sessionId -> timestamp
    this.planets = new Map(); // planetId -> planetData
    this.loadPlanets();

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
        player.name = name.trim().slice(0, 18);
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

  ejectPlayer(targetId, shooterId) {
    const target = this.state.players.get(targetId);
    if (!target) return;

    if (!this.lastEjectionTimes) this.lastEjectionTimes = new Map();
    this.lastEjectionTimes.set(targetId, Date.now());

    const EJECTION_COORDS = { x: 10000, y: 10000, z: 10000 };

    // Teleport to deep space and restore health
    target.x = EJECTION_COORDS.x;
    target.y = EJECTION_COORDS.y;
    target.z = EJECTION_COORDS.z;
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
    player.x = (Math.random() - 0.5) * 30;
    player.y = (Math.random() - 0.5) * 10;
    player.z = (Math.random() - 0.5) * 30;
    player.rotation = (Math.random() - 0.5) * Math.PI * 2;
    player.pitch = 0;
    player.health = 100;

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
  }

  loadPlanets() {
    try {
      if (fs.existsSync(PLANETS_FILE)) {
        const raw = fs.readFileSync(PLANETS_FILE, "utf8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((p) => {
            if (p && p.id) this.planets.set(p.id, p);
          });
          console.log(`[SpaceRoom] Loaded ${this.planets.size} persistent planets from disk.`);
        }
      }
    } catch (err) {
      console.warn("[SpaceRoom] Error loading planets file:", err);
    }

    // If no planets exist, seed with iconic landmarks
    if (this.planets.size === 0) {
      const defaultPlanet = {
        id: "planet_prime_aethelgard",
        name: "Aethelgard Prime",
        builderId: "SYSTEM",
        builderName: "Multiverse Core",
        form: "ringed_giant",
        radius: 38,
        primaryColor: "#00f0ff",
        secondaryColor: "#9d00ff",
        rings: "double",
        moons: 2,
        hasAtmosphere: true,
        position: { x: -90, y: -80, z: -280 },
        createdAt: Date.now(),
      };
      this.planets.set(defaultPlanet.id, defaultPlanet);
      this.savePlanets();
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
    this.state.players.delete(client.sessionId);
    this.lastShootTimes.delete(client.sessionId);
    this.lastDamageTimes.delete(client.sessionId);

    this.broadcast("player_left", { id: client.sessionId });
  }

  onDispose() {
    console.log(`[SpaceRoom] Room ${this.roomId} disposed`);
  }
}
