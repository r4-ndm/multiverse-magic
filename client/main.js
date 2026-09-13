import * as THREE from "three";
import { SceneSystem } from "./systems/SceneSystem.js";
import { PlayerSystem } from "./systems/PlayerSystem.js";
import { NetworkSystem } from "./systems/NetworkSystem.js";
import { AudioSystem } from "./systems/AudioSystem.js";
import { CombatSystem } from "./systems/CombatSystem.js";
import { WorldSystem, PlanetBeacon, HyperlaneGate } from "./systems/WorldObject.js";
import { CustomPlanet } from "./systems/Planet.js";
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
    this.hyperlaneGate = null;

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

    // Read current solar system from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    this.currentSystemId = urlParams.get("system") || "sol";

    // Configure system theme and jump destination
    this.currentSystemName = "SOL PRIME";
    let gateDestName = "VEGA OUTPOST";
    let gateDestUrl = "/?system=vega";
    let gateDist = 14.2;

    if (this.currentSystemId === "vega") {
      this.currentSystemName = "VEGA OUTPOST";
      gateDestName = "SOL PRIME";
      gateDestUrl = "/?system=sol";
      gateDist = 14.2;
    } else if (this.currentSystemId === "kepler") {
      this.currentSystemName = "KEPLER VOID";
      gateDestName = "SOL PRIME";
      gateDestUrl = "/?system=sol";
      gateDist = 48.7;
    } else if (this.currentSystemId === "centauri") {
      this.currentSystemName = "ALPHA CENTAURI";
      gateDestName = "SOL PRIME";
      gateDestUrl = "/?system=sol";
      gateDist = 4.3;
    }

    // Register distant planetoid beacon & massive Interstellar Hyperlane Gate
    this.worldSystem.register(new PlanetBeacon("nexus_beacon", new THREE.Vector3(0, -120, -350), 45));
    this.hyperlaneGate = new HyperlaneGate("main_hyperlane_gate", new THREE.Vector3(0, 15, -150), gateDestName, gateDestUrl, gateDist);
    this.worldSystem.register(this.hyperlaneGate);

    // Keyboard trigger: KeyJ for Hyperdrive Jump or Starmap
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyJ" && !e.repeat) {
        if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
          if (this.hyperlaneGate?.isNearGate(this.playerSystem?.position)) {
            this.hyperlaneGate.engageJump(this.playerSystem, this.audioSystem, this.overlay);
          } else {
            this.overlay.toggleStarmapModal();
          }
        }
      }
    });

    // 3. Initialize Overlay UI and entry flow
    this.overlay.init(
      async (pilotName, characterType, color, avatarUrl) => {
        await this.handleUserEntry(pilotName, characterType, color, avatarUrl);
      },
      (text) => {
        if (this.networkSystem?.room) {
          this.networkSystem.room.send("chat", text);
        }
      },
      (newType, newColor, newUrl, newName) => {
        if (newName && newName !== this.pilotName) {
          this.pilotName = newName;
          this.playerSystem.setLocalName(newName);
          this.overlay.setPlayerInfo(this.networkSystem.sessionId, this.currentSystemName, newName);
          this.networkSystem.sendSetName(newName);
        }
        this.playerSystem.setLocalCharacter(newType, newColor, newUrl);
        this.networkSystem.sendSetCharacter(newType, newColor, newUrl);

        // Automatically switch to 3rd-person view so the player sees their new avatar form!
        this.playerSystem.setCameraMode("third");
      },
      () => {
        this.playerSystem?.toggleCameraMode();
      },
      this.hyperlaneGate,
      this.playerSystem,
      this.audioSystem,
      (planetConfig) => {
        let spawnPos;
        if (planetConfig.placement === "exact") {
          spawnPos = this.playerSystem.position.clone();
        } else {
          // 120 units ahead along ship's heading vector
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.playerSystem.quaternion);
          spawnPos = this.playerSystem.position.clone().add(forward.multiplyScalar(120));
        }
        planetConfig.position = { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z };
        this.networkSystem.sendBuildPlanet(planetConfig);
      }
    );

    // 4. Start Render Loop
    this.animate();
  }

  async handleUserEntry(pilotName, characterType = "astronaut", color = "#00f0ff", avatarUrl = "") {
    console.log(`[OpenSpaceApp] Pilot [${pilotName}] (${characterType}) entered space. Initializing Audio & Network...`);
    this.pilotName = pilotName || `Pilot-${Math.floor(1000 + Math.random() * 9000)}`;
    this.playerSystem.setLocalName(this.pilotName);
    this.playerSystem.setLocalCharacter(characterType, color, avatarUrl);

    // 1. Audio Activation: user gesture enables AudioContext & getUserMedia mic stream
    const audioResult = await this.audioSystem.init(this.networkSystem, this.playerSystem);
    if (!audioResult.hasMic) {
      this.overlay.addLogItem("🎙️ Microphone unavailable: Entered in Listen-Only mode");
    } else {
      this.overlay.addLogItem("🎙️ Spatial Proximity Mic activated (50u radius)");
    }

    // 2. Connect to Colyseus Server
    try {
      // Initialize Combat System with network and audio
      this.combatSystem.init(this.networkSystem, this.playerSystem, this.audioSystem);

      // Wire up network event handlers BEFORE connecting so onPlayerAdd catches local player
      this.setupNetworkHooks();

      const room = await this.networkSystem.connect(null, {
        name: this.pilotName,
        characterType,
        color,
        avatarUrl,
      });
      this.overlay.setPlayerInfo(room.sessionId, this.currentSystemName, this.pilotName);
      this.overlay.addLogItem(`🌌 Pilot [${this.pilotName}] connected to Sector [${this.currentSystemName}] as [${characterType.toUpperCase()}]`);

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
        this.playerSystem.setLocalHealth(playerState.health);
        this.playerSystem.setLocalName(playerState.name || this.pilotName);
      } else {
        // Remote peer
        this.playerSystem.addOrUpdateRemotePlayer(sessionId, playerState);
        const name = playerState.name || sessionId.slice(0, 6);
        const form = (playerState.characterType || "pilot").toUpperCase();
        this.overlay.addLogItem(`Pilot [${name}] materialized nearby as [${form}]`);
      }
    };

    // Dynamic morph handler from remote peers
    this.networkSystem.onCharacterChanged = (id, data) => {
      if (id !== this.networkSystem.sessionId) {
        this.playerSystem.updateRemoteCharacter(id, data);
        const name = data.name || id.slice(0, 6);
        this.overlay.addLogItem(`✨ Pilot [${name}] transmuted into [${(data.characterType || "form").toUpperCase()}]`);
      }
    };

    // Dynamic name change handler
    this.networkSystem.onNameChanged = (id, newName) => {
      if (id === this.networkSystem.sessionId) {
        this.pilotName = newName;
        this.playerSystem.setLocalName(newName);
        this.overlay.setPlayerInfo(id, this.networkSystem.room?.name, newName);
      } else {
        const remote = this.playerSystem.remotePlayers.get(id);
        if (remote) {
          remote.name = newName;
          this.playerSystem.updateNametagSprite(remote.nametagSprite, newName, remote.health);
        }
        this.overlay.addLogItem(`Pilot changed callsign to [${newName}]`);
      }
    };

    // 2. Player Changed (Movement / Health / Name updates)
    this.networkSystem.onPlayerChange = (sessionId, playerState) => {
      if (sessionId === this.networkSystem.sessionId) {
        if (playerState.health !== this.playerSystem.health) {
          this.playerSystem.setLocalHealth(playerState.health);
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
      if (data.targetId === this.networkSystem.sessionId) {
        this.playerSystem.setLocalHealth(data.health);
      }
    };

    // 5. Deep Space Ejection
    this.networkSystem.onPlayerEjected = (data) => {
      const isLocal = data.targetId === this.networkSystem.sessionId;
      const targetName = data.targetName || data.targetId.slice(0, 6);
      this.audioSystem.playWhooshSound();

      if (isLocal) {
        // Local player ejected!
        this.playerSystem.teleport(
          data.ejectionCoords.x,
          data.ejectionCoords.y,
          data.ejectionCoords.z
        );
        this.playerSystem.setLocalHealth(100);
        this.overlay.showEjection(true, targetName, data.ejectionCoords);
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
        this.audioSystem.disconnectPeer(data.targetId);
        this.overlay.showEjection(false, targetName, data.ejectionCoords);
      }
    };

    // 6. WebRTC Signaling relay
    this.networkSystem.onSignalReceived = (fromSessionId, signal) => {
      this.audioSystem.handleSignal(fromSessionId, signal);
    };

    // 7. Pilot & AI Agent Chat with 3D Spatial Voice Synthesis
    this.networkSystem.onChatMessage = (data) => {
      const name = data.senderName || data.senderId.slice(0, 6);
      this.overlay.addLogItem(`💬 [${name}]: ${data.text}`);

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

    // 9. Persistent Planet Synchronization
    this.networkSystem.onPlanetsSync = (planets) => {
      console.log(`[OpenSpaceApp] Received ${planets?.length || 0} persistent planets.`);
      if (Array.isArray(planets)) {
        planets.forEach((pData) => {
          if (pData && pData.id && !this.worldSystem.objects.has(pData.id)) {
            const planet = new CustomPlanet(pData);
            this.worldSystem.register(planet);
          }
        });
      }
    };

    this.networkSystem.onPlanetCreated = (pData) => {
      if (pData && pData.id && !this.worldSystem.objects.has(pData.id)) {
        const planet = new CustomPlanet(pData);
        this.worldSystem.register(planet);
        this.audioSystem?.playPlanetSpawnSound();
        this.overlay.addLogItem(`🪐 [GENESIS] Pilot [${pData.builderName}] forged new planet: "${pData.name}"!`);
      }
    };

    this.networkSystem.onPlanetDeleted = (planetId) => {
      this.worldSystem.unregister(planetId);
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

    // 4. Update modular world objects (Hyperlane Jump Gate, planetoids)
    this.worldSystem.update(
      delta,
      elapsedTime,
      this.playerSystem?.position,
      this.playerSystem,
      this.audioSystem,
      this.overlay
    );

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
