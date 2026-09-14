import { Client } from "colyseus.js";

/**
 * NetworkSystem manages the Colyseus WebSocket connection, room joining,
 * state synchronization (players map), throttled position broadcasting,
 * and custom event dispatching (combat, signaling, ejections).
 */
export class NetworkSystem {
  constructor() {
    this.client = null;
    this.room = null;
    this.sessionId = null;
    this.lastSentTime = 0;
    this.sendInterval = 50; // 50ms (20Hz throttled sync)

    // Callbacks to hook systems
    this.onPlayerAdd = null;
    this.onPlayerChange = null;
    this.onPlayerRemove = null;
    this.onShotFired = null;
    this.onPlayerHit = null;
    this.onPlayerEjected = null;
    this.onStillExiled = null;
    this.onSignalReceived = null;
    this.onChatMessage = null;
    this.onNameChanged = null;
    this.onLogEvent = null;
    this.onPlanetsSync = null;
    this.onPlanetCreated = null;
    this.onPlanetDeleted = null;
    this.onPlanetDamaged = null;
    this.onBlocksSync = null;
    this.onBlockPlaced = null;
    this.onBlockDamaged = null;
    this.onBlockDeleted = null;
    this.onBlockRejected = null;
    this.onLinksSync = null;
    this.onLinkPainted = null;
    this.onLinkCleared = null;
    this.onLinkRejected = null;
    this.onMeetingScheduled = null;
    this.onMeetingRejected = null;
    this.onMeetArrived = null;
    this.onMeetMissing = null;
  }

  async connect(serverUrl, options = {}) {
    // Zero friction: Room determined by URL param or default "space"
    const params = new URLSearchParams(window.location.search);
    const roomName = params.get("room") || "space";
    if (params.get("meet") && !options.meet) options.meet = params.get("meet");

    let defaultWsUrl;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      defaultWsUrl = `ws://${window.location.hostname}:2567`;
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      defaultWsUrl = `${protocol}//${window.location.host}`;
    }

    const wsUrl = serverUrl || defaultWsUrl;

    console.log(`[NetworkSystem] Connecting to ${wsUrl} (room: ${roomName})...`);
    this.client = new Client(wsUrl);

    try {
      this.room = await this.client.joinOrCreate(roomName, options);
      this.sessionId = this.room.sessionId;
      console.log(`[NetworkSystem] Joined room: ${this.room.id} as ${this.sessionId} (Pilot: ${options.name || 'Anonymous'})`);

      this.setupRoomListeners();
      return this.room;
    } catch (err) {
      console.error("[NetworkSystem] Failed to join room:", err);
      throw err;
    }
  }

  setupRoomListeners() {
    // 1. Sync remote players from state
    this.room.state.players.onAdd((player, key) => {
      console.log(`[NetworkSystem] Player added: ${key}`);
      if (this.onPlayerAdd) this.onPlayerAdd(key, player);

      player.onChange(() => {
        if (this.onPlayerChange) this.onPlayerChange(key, player);
      });
    });

    // Also process any players already loaded in initial state snapshot
    this.room.state.players.forEach((player, key) => {
      if (this.onPlayerAdd) this.onPlayerAdd(key, player);
    });

    this.room.state.players.onRemove((player, key) => {
      console.log(`[NetworkSystem] Player removed: ${key}`);
      if (this.onPlayerRemove) this.onPlayerRemove(key);
    });

    // 2. Broadcast combat & ejection messages
    this.room.onMessage("shot_fired", (data) => {
      if (this.onShotFired) this.onShotFired(data);
    });

    this.room.onMessage("player_hit", (data) => {
      if (this.onPlayerHit) this.onPlayerHit(data);
    });

    this.room.onMessage("player_ejected", (data) => {
      if (this.onPlayerEjected) this.onPlayerEjected(data);
    });

    this.room.onMessage("still_exiled", (data) => {
      if (this.onStillExiled) this.onStillExiled(data);
    });

    this.room.onMessage("signal", (data) => {
      if (this.onSignalReceived) this.onSignalReceived(data.from, data.signal);
    });

    this.room.onMessage("chat", (data) => {
      if (this.onChatMessage) this.onChatMessage(data);
    });

    this.room.onMessage("name_changed", (data) => {
      if (this.onNameChanged) this.onNameChanged(data.id, data.name);
    });

    this.room.onMessage("character_changed", (data) => {
      if (this.onCharacterChanged) this.onCharacterChanged(data.id, data);
    });

    this.room.onMessage("player_joined", (data) => {
      const name = data.name || data.id.slice(0, 6);
      if (this.onLogEvent) this.onLogEvent(`Pilot [${name}] entered space`);
    });

    this.room.onMessage("player_left", (data) => {
      if (this.onLogEvent) this.onLogEvent(`Pilot [${data.id.slice(0, 6)}] left space`);
    });

    // Persistent Planet Handlers
    this.room.onMessage("planets_sync", (planets) => {
      if (this.onPlanetsSync) this.onPlanetsSync(planets);
    });

    this.room.onMessage("planet_created", (planetData) => {
      if (this.onPlanetCreated) this.onPlanetCreated(planetData);
    });

    this.room.onMessage("planet_deleted", (data) => {
      if (this.onPlanetDeleted) this.onPlanetDeleted(data.id);
    });

    this.room.onMessage("planet_damaged", (data) => {
      if (this.onPlanetDamaged) this.onPlanetDamaged(data);
    });

    this.room.onMessage("blocks_sync", (blocks) => {
      if (this.onBlocksSync) this.onBlocksSync(blocks);
    });

    this.room.onMessage("block_placed", (data) => {
      if (this.onBlockPlaced) this.onBlockPlaced(data);
    });

    this.room.onMessage("block_damaged", (data) => {
      if (this.onBlockDamaged) this.onBlockDamaged(data);
    });

    this.room.onMessage("block_deleted", (data) => {
      if (this.onBlockDeleted) this.onBlockDeleted(data.id);
    });

    this.room.onMessage("block_rejected", (data) => {
      if (this.onBlockRejected) this.onBlockRejected(data);
    });

    this.room.onMessage("links_sync", (links) => {
      if (this.onLinksSync) this.onLinksSync(links);
    });

    this.room.onMessage("link_painted", (data) => {
      if (this.onLinkPainted) this.onLinkPainted(data);
    });

    this.room.onMessage("link_cleared", (data) => {
      if (this.onLinkCleared) this.onLinkCleared(data);
    });

    this.room.onMessage("link_rejected", (data) => {
      if (this.onLinkRejected) this.onLinkRejected(data);
    });

    this.room.onMessage("meeting_scheduled", (data) => {
      if (this.onMeetingScheduled) this.onMeetingScheduled(data);
    });

    this.room.onMessage("meeting_rejected", (data) => {
      if (this.onMeetingRejected) this.onMeetingRejected(data);
    });

    this.room.onMessage("meet_arrived", (data) => {
      if (this.onMeetArrived) this.onMeetArrived(data);
    });

    this.room.onMessage("meet_missing", (data) => {
      if (this.onMeetMissing) this.onMeetMissing(data);
    });
  }

  /**
   * Throttled position update to server (every 50ms)
   */
  sendPosition(x, y, z, rotation, pitch, driving = false) {
    if (!this.room) return;
    const now = performance.now();
    if (now - this.lastSentTime < this.sendInterval) return;

    this.lastSentTime = now;
    this.room.send("move", {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      z: Number(z.toFixed(2)),
      rotation: Number(rotation.toFixed(3)),
      pitch: Number(pitch.toFixed(3)),
      driving: !!driving,
    });
  }

  sendShoot(targetId, origin, direction, hitPoint) {
    if (!this.room) return;
    this.room.send("shoot", {
      targetId,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      hitPoint: hitPoint ? { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z } : null,
    });
  }

  sendHit(targetId) {
    if (!this.room) return;
    this.room.send("hit", { targetId });
  }

  sendSignal(to, signal) {
    if (!this.room) return;
    this.room.send("signal", { to, signal });
  }

  sendSetCharacter(characterType, color, avatarUrl = "") {
    if (!this.room) return;
    this.room.send("set_character", { characterType, color, avatarUrl });
  }

  sendSetName(name) {
    if (!this.room) return;
    this.room.send("set_name", name);
  }

  sendPlaceBlock(x, y, z, color) {
    if (!this.room) return;
    this.room.send("place_block", { x, y, z, color });
  }

  sendBuildPlanet(planetData) {
    if (!this.room) return;
    this.room.send("build_planet", planetData);
  }

  sendDeletePlanet(planetId) {
    if (!this.room) return;
    this.room.send("delete_planet", { id: planetId });
  }

  sendScheduleMeeting(blockId, face, title, startsAt) {
    if (!this.room) return;
    this.room.send("schedule_meeting", { blockId, face, title, startsAt });
  }

  sendMeetGoto(id) {
    if (!this.room || !id) return;
    this.room.send("meet_goto", { id });
  }

  sendPaintLink(blockId, face, url) {
    if (!this.room) return;
    this.room.send("paint_link", { blockId, face, url });
  }
}
