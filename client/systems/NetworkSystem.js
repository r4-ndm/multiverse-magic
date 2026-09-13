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
    this.onSignalReceived = null;
    this.onChatMessage = null;
    this.onNameChanged = null;
    this.onLogEvent = null;
  }

  async connect(serverUrl, options = {}) {
    // Zero friction: Room determined by URL param or default "space"
    const params = new URLSearchParams(window.location.search);
    const roomName = params.get("room") || "space";

    const wsUrl =
      serverUrl ||
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:2567`;

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

    this.room.onMessage("signal", (data) => {
      if (this.onSignalReceived) this.onSignalReceived(data.from, data.signal);
    });

    this.room.onMessage("chat", (data) => {
      if (this.onChatMessage) this.onChatMessage(data);
    });

    this.room.onMessage("name_changed", (data) => {
      if (this.onNameChanged) this.onNameChanged(data.id, data.name);
    });

    this.room.onMessage("player_joined", (data) => {
      const name = data.name || data.id.slice(0, 6);
      if (this.onLogEvent) this.onLogEvent(`Pilot [${name}] entered space`);
    });

    this.room.onMessage("player_left", (data) => {
      if (this.onLogEvent) this.onLogEvent(`Pilot [${data.id.slice(0, 6)}] left space`);
    });
  }

  /**
   * Throttled position update to server (every 50ms)
   */
  sendPosition(x, y, z, rotation, pitch) {
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
}
