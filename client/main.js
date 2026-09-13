import * as THREE from "three";
import { SceneSystem } from "./systems/SceneSystem.js";
import { PlayerSystem } from "./systems/PlayerSystem.js";
import { NetworkSystem } from "./systems/NetworkSystem.js";
import { AudioSystem } from "./systems/AudioSystem.js";
import { CombatSystem } from "./systems/CombatSystem.js";
import { WorldSystem, PlanetBeacon } from "./systems/WorldObject.js";
import { Overlay } from "./ui/Overlay.js";

/**
 * OpenSpace — Client Main Orchestrator
 * Connects 3D rendering, flight controls, multiplayer state synchronization,
 * WebRTC spatial proximity audio, and laser combat.
 */
class OpenSpaceApp {
  constructor() {
    this.canvas = document.getElementById("webgl-canvas");
    this.clock = new THREE.Clock();

    // Instantiate systems
    this.sceneSystem = new SceneSystem();
    this.networkSystem = new NetworkSystem();
    this.overlay = new Overlay();

    this.playerSystem = null;
    this.audioSystem = null;
    this.combatSystem = null;
    this.worldSystem = null;

    this.isEntered = false;
  }

  async start() {
    // 1. Initialize Scene & Renderer
    const { scene, camera, renderer } = this.sceneSystem.init(this.canvas);

    // 2. Initialize Player & Systems
    this.playerSystem = new PlayerSystem(scene, camera);
    this.playerSystem.init(this.canvas);

    this.combatSystem = new CombatSystem(scene, camera);
    this.audioSystem = new AudioSystem(camera);

    this.worldSystem = new WorldSystem(scene);
    // Extensibility showcase: register a distant planetoid beacon
    this.worldSystem.register(new PlanetBeacon("nexus_beacon", new THREE.Vector3(0, -120, -350), 45));

    // 3. Initialize Overlay UI and entry flow
    this.overlay.init(
      async () => {
        await this.handleUserEntry();
      },
      (text) => {
        if (this.networkSystem?.room) {
          this.networkSystem.room.send("chat", text);
        }
      }
    );

    // 4. Start Render Loop
    this.animate();
  }

  async handleUserEntry() {
    console.log("[OpenSpaceApp] User entered space. Initializing Audio & Network...");

    // 1. Audio Activation: user gesture enables AudioContext & getUserMedia mic stream
    const audioResult = await this.audioSystem.init(this.networkSystem, this.playerSystem);
    if (!audioResult.hasMic) {
      this.overlay.addLogItem("🎙️ Microphone unavailable: Entered in Listen-Only mode");
    } else {
      this.overlay.addLogItem("🎙️ Spatial Proximity Mic activated (50u radius)");
    }

    // 2. Connect to Colyseus Server
    try {
      const room = await this.networkSystem.connect();
      this.overlay.setPlayerInfo(room.sessionId, room.name);
      this.overlay.addLogItem(`🌌 Connected to Space Sector [${room.id}]`);

      // Initialize Combat System with network and audio
      this.combatSystem.init(this.networkSystem, this.playerSystem, this.audioSystem);

      // Wire up network event handlers
      this.setupNetworkHooks();

      this.isEntered = true;
    } catch (err) {
      console.error("[OpenSpaceApp] Connection error:", err);
      this.overlay.addLogItem("⚠️ Failed to connect to universe server. Retrying...", true);
    }
  }

  setupNetworkHooks() {
    // 1. Remote Player Added
    this.networkSystem.onPlayerAdd = (sessionId, playerState) => {
      if (sessionId === this.networkSystem.sessionId) {
        // Local player initial state
        this.playerSystem.localId = sessionId;
        this.playerSystem.teleport(playerState.x, playerState.y, playerState.z);
        this.playerSystem.health = playerState.health;
      } else {
        // Remote peer
        this.playerSystem.addOrUpdateRemotePlayer(sessionId, playerState);
        this.overlay.addLogItem(`Pilot [${sessionId.slice(0, 6)}] materialized nearby`);
      }
    };

    // 2. Player Changed (Movement / Health updates)
    this.networkSystem.onPlayerChange = (sessionId, playerState) => {
      if (sessionId === this.networkSystem.sessionId) {
        // Local health update
        if (playerState.health !== this.playerSystem.health) {
          this.playerSystem.health = playerState.health;
        }
      } else {
        this.playerSystem.addOrUpdateRemotePlayer(sessionId, playerState);
      }
    };

    // 3. Remote Player Left
    this.networkSystem.onPlayerRemove = (sessionId) => {
      this.playerSystem.removeRemotePlayer(sessionId);
      this.audioSystem.disconnectPeer(sessionId);
    };

    // 4. Combat & Lasers
    this.networkSystem.onShotFired = (data) => {
      this.combatSystem.handleShotFired(data);
    };

    this.networkSystem.onPlayerHit = (data) => {
      this.combatSystem.handlePlayerHit(data);
    };

    // 5. Deep Space Ejection
    this.networkSystem.onPlayerEjected = (data) => {
      const isLocal = data.targetId === this.networkSystem.sessionId;
      this.audioSystem.playWhooshSound();

      if (isLocal) {
        // Local player ejected!
        this.playerSystem.teleport(
          data.ejectionCoords.x,
          data.ejectionCoords.y,
          data.ejectionCoords.z
        );
        this.playerSystem.health = 100;
        this.overlay.showEjection(true, data.targetId, data.ejectionCoords);
      } else {
        // Remote player ejected
        const remote = this.playerSystem.remotePlayers.get(data.targetId);
        if (remote) {
          remote.mesh.position.set(
            data.ejectionCoords.x,
            data.ejectionCoords.y,
            data.ejectionCoords.z
          );
        }
        // Naturally disconnect proximity audio since they are now at (10000, 10000, 10000)
        this.audioSystem.disconnectPeer(data.targetId);
        this.overlay.showEjection(false, data.targetId, data.ejectionCoords);
      }
    };

    // 6. WebRTC Signaling relay
    this.networkSystem.onSignalReceived = (fromSessionId, signal) => {
      this.audioSystem.handleSignal(fromSessionId, signal);
    };

    // 7. Pilot & AI Agent Chat with 3D Spatial Voice Synthesis
    this.networkSystem.onChatMessage = (data) => {
      this.overlay.addLogItem(`💬 [${data.senderId.slice(0, 6)}]: ${data.text}`);

      // If sender is remote, speak their message in 3D spatial proximity!
      if (data.senderId !== this.networkSystem.sessionId) {
        const remote = this.playerSystem.remotePlayers.get(data.senderId);
        const pos = remote ? remote.mesh.position : null;
        this.audioSystem.speakSpatial(data.text, pos);
      }
    };

    // 8. General event logs
    this.networkSystem.onLogEvent = (msg) => {
      this.overlay.addLogItem(msg);
    };
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update celestial scene drift
    this.sceneSystem.update(delta, elapsedTime);

    // 2. Update player controls and physics
    this.playerSystem.update(delta);

    // 3. Update combat effects (laser beam lifespan, hit sparks)
    this.combatSystem.update(delta);

    // 4. Update modular world objects
    this.worldSystem.update(delta, elapsedTime);

    // 5. If joined universe, sync state and proximity
    if (this.isEntered) {
      // Send throttled position update (every 50ms)
      this.networkSystem.sendPosition(
        this.playerSystem.position.x,
        this.playerSystem.position.y,
        this.playerSystem.position.z,
        this.playerSystem.euler.y,
        this.playerSystem.euler.x
      );

      // Check spatial audio proximity (50 units)
      this.audioSystem.updateProximity();

      // Update HUD coordinates and health
      this.overlay.updateHUD(this.playerSystem.position, this.playerSystem.health);
    }

    // 6. Render Frame
    this.sceneSystem.renderer.render(this.sceneSystem.scene, this.sceneSystem.camera);
  }
}

// Bootstrap application on window load
window.addEventListener("DOMContentLoaded", () => {
  const app = new OpenSpaceApp();
  app.start();
});
