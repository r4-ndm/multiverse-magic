import * as THREE from "three";
import { SceneSystem } from "./systems/SceneSystem.js";
import { PlayerSystem } from "./systems/PlayerSystem.js";
import { NetworkSystem } from "./systems/NetworkSystem.js";
import { AudioSystem } from "./systems/AudioSystem.js";
import { CombatSystem } from "./systems/CombatSystem.js";
import { WorldSystem, PlanetBeacon } from "./systems/WorldObject.js";
import { CustomPlanet } from "./systems/Planet.js";
import { BuildBlock } from "./systems/BuildBlock.js";
import { updateGraffitiLinks } from "./systems/BuildBlock.js";
import { Overlay } from "./ui/Overlay.js";
import { VehicleSystem } from "./systems/VehicleSystem.js";

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
    this.vehicleSystem = null;
    this.pendingLinks = [];

    this.isEntered = false;
    window.multiverseApp = this;
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
    this.vehicleSystem = new VehicleSystem(scene);
    this.vehicleSystem.init(this.playerSystem, this.worldSystem, this.audioSystem);

    this.currentSystemId = "sol";
    this.currentSystemName = "OPEN SPACE";

    this.worldSystem.register(new PlanetBeacon("nexus_beacon", new THREE.Vector3(0, -120, -350), 45));

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
      },
      null,
      null,
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
      },
      null
    );
    this.overlay.onToggleBlockGun = (armed) => {
      this.combatSystem?.setWeaponMode(armed ? "block" : "laser");
    };
    this.overlay.onToggleLinkGun = (armed) => {
      this.combatSystem?.setWeaponMode(armed ? "link" : "laser");
    };
    this.overlay.onToggleMeetGun = (armed) => {
      this.combatSystem?.setWeaponMode(armed ? "meet" : "laser");
    };
    this.playerSystem.worldSystem = this.worldSystem;
    this.playerSystem.onGravityChange = (on) => {
      this.overlay?.setGravityState(on);
    };
    this.vehicleSystem.onDrivingChange = (on, kind) => {
      this.overlay?.setDrivingState(on, kind);
    };

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
    this.vehicleSystem?.setAudio(this.audioSystem);
    if (!audioResult.hasMic) {
      this.overlay.addLogItem("🎙️ Microphone unavailable: Entered in Listen-Only mode");
    } else {
      this.overlay.addLogItem("🎙️ Spatial Proximity Mic activated (50u radius)");
    }

    // 2. Connect to Colyseus Server
    try {
      // Initialize Combat System with network and audio
      this.combatSystem.init(this.networkSystem, this.playerSystem, this.audioSystem, this.worldSystem);

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
        this.overlay.showEjection(true, targetName, data.ejectionCoords, this.playerSystem.deepCruise);
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

    this.networkSystem.onStillExiled = () => {
      this.overlay.resumeExile();
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

    this.networkSystem.onPlanetDamaged = (data) => {
      const planet = data?.id ? this.worldSystem.objects.get(data.id) : null;
      if (planet?.setHealth && typeof data.health === "number") {
        planet.setHealth(data.health);
      }
    };

    const paintMeeting = (data) => {
      if (!data?.blockId || !data.face || !data.id) return;
      const block = this.worldSystem.objects.get(data.blockId);
      if (!block?.setGraffiti) return;
      block.tags?.forEach((tag, face) => {
        if (face !== data.face && tag.meta?.kind === "meeting") block.clearGraffiti(face);
      });
      const url = this.overlay?.getMeetingUrl(data.id) || `/?meet=${data.id}`;
      block.setGraffiti(data.face, url, Infinity, {
        kind: "meeting",
        title: data.title,
        startsAt: data.startsAt,
        meetId: data.id,
      });
    };

    const spawnBlock = (data) => {
      if (!data?.id || this.worldSystem.objects.has(data.id)) return;
      this.worldSystem.register(new BuildBlock(data));
      const block = this.worldSystem.objects.get(data.id);
      if (block) this.vehicleSystem?.spawnForBlock(block);
      if (data.meeting) {
        paintMeeting({
          blockId: data.id,
          face: data.meeting.face,
          id: data.meeting.id,
          title: data.meeting.title,
          startsAt: data.meeting.startsAt,
        });
      }
      this.pendingLinks = this.pendingLinks.filter((link) => {
        if (link.blockId !== data.id) return true;
        this.applyLink(link);
        return false;
      });
    };

    this.forgetSprayedLink = (blockId, face) => {
      this.pendingLinks = this.pendingLinks.filter((link) => {
        if (link.blockId !== blockId || (face && link.face !== face)) return true;
        link.url = "";
        return false;
      });
    };

    this.sweepExpiredLinks = () => {
      const now = Date.now();
      this.pendingLinks = this.pendingLinks.filter((link) => {
        if (link.expiresAt && now < link.expiresAt) return true;
        link.url = "";
        return false;
      });
    };

    this.applyLink = (data) => {
      if (!data?.blockId || !data.face) return;
      if (!data.url || !data.expiresAt || Date.now() >= data.expiresAt) {
        this.forgetSprayedLink(data.blockId, data.face);
        const gone = this.worldSystem.objects.get(data.blockId);
        if (gone?.tags?.get(data.face)?.meta?.kind !== "meeting") gone?.clearGraffiti?.(data.face);
        return;
      }
      const block = this.worldSystem.objects.get(data.blockId);
      if (!block?.setGraffiti) {
        this.pendingLinks = this.pendingLinks.filter((link) => !(link.blockId === data.blockId && link.face === data.face));
        this.pendingLinks.push(data);
        return;
      }
      this.forgetSprayedLink(data.blockId, data.face);
      block.setGraffiti(data.face, data.url, data.expiresAt);
    };

    this.networkSystem.onBlocksSync = (blocks) => {
      if (!Array.isArray(blocks)) return;
      blocks.forEach(spawnBlock);
    };

    this.networkSystem.onBlockPlaced = (data) => {
      spawnBlock(data);
    };

    this.networkSystem.onBlockDamaged = (data) => {
      const block = data?.id ? this.worldSystem.objects.get(data.id) : null;
      if (block?.setHealth && typeof data.health === "number") {
        block.setHealth(data.health);
      }
    };

    this.networkSystem.onBlockDeleted = (blockId) => {
      const block = this.worldSystem.objects.get(blockId);
      if (block?.mesh && this.combatSystem) {
        this.combatSystem.createHitSpark(block.mesh.position.clone(), 0xffd700);
      }
      this.vehicleSystem?.removeForBlock(blockId);
      this.forgetSprayedLink(blockId);
      this.worldSystem.unregister(blockId);
      this.overlay?.addLogItem("💥 Container destroyed.");
    };

    this.networkSystem.onBlockRejected = (data) => {
      this.overlay?.addLogItem(`📦 ${data?.reason || "Couldn't place that container."}`);
    };

    this.networkSystem.onPlanetDeleted = (planetId) => {
      const planet = this.worldSystem.objects.get(planetId);
      if (planet?.mesh && this.combatSystem) {
        const origin = planet.mesh.position.clone();
        this.combatSystem.createHitSpark(origin, 0xff6600);
        this.combatSystem.createHitSpark(origin.clone().add(new THREE.Vector3(4, 2, 0)), 0xff0055);
        this.combatSystem.createHitSpark(origin.clone().add(new THREE.Vector3(-3, -1, 2)), 0xffd700);
      }
      this.worldSystem.unregister(planetId);
    };

    this.networkSystem.onLinksSync = (links) => {
      if (!Array.isArray(links)) return;
      links.forEach((link) => this.applyLink(link));
    };
    this.networkSystem.onLinkPainted = (data) => this.applyLink(data);
    this.networkSystem.onLinkCleared = (data) => {
      if (!data?.blockId) return;
      this.forgetSprayedLink(data.blockId, data.face);
      const block = this.worldSystem.objects.get(data.blockId);
      if (block?.tags?.get(data.face)?.meta?.kind === "meeting") return;
      block?.clearGraffiti?.(data.face);
    };
    this.networkSystem.onLinkRejected = (data) => {
      this.overlay?.addLogItem(`🔗 ${data?.reason || "Couldn't spray that link."}`);
    };

    this.networkSystem.onMeetingScheduled = (data) => {
      paintMeeting(data);
      const href = this.overlay?.getMeetingUrl(data.id);
      if (data.hostId === this.networkSystem.sessionId && href) {
        navigator.clipboard?.writeText(href).catch(() => {});
        this.overlay?.addLogItem(`📅 Meeting booked. Save this link: ${href}`);
      }
    };
    this.networkSystem.onMeetingRejected = (data) => {
      this.overlay?.addLogItem(`📅 ${data?.reason || "Couldn't book that meeting."}`);
    };
    this.networkSystem.onMeetArrived = (data) => {
      if (!data) return;
      this.playerSystem?.teleport(data.x, data.y, data.z);
      this.overlay?.addLogItem(`📅 Arrived at meeting: ${data.title || "Meeting"}`);
      const url = new URL(window.location.href);
      if (url.searchParams.has("meet")) {
        url.searchParams.delete("meet");
        history.replaceState({}, "", url);
      }
    };
    this.networkSystem.onMeetMissing = () => {
      this.overlay?.addLogItem("📅 That meeting place is gone.");
    };

    this.goToMeeting = (id) => {
      this.networkSystem?.sendMeetGoto(id);
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

    // 4. Update modular world objects (planetoids, containers)
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
        (this.playerSystem.drivingCar || this.playerSystem.gravityOn) ? 0 : this.playerSystem.euler.x,
        !!this.playerSystem.drivingCar
      );

      // Check spatial audio proximity (50 units)
      this.audioSystem.updateProximity();

      // Update HUD coordinates and health
      this.overlay.updateHUD(this.playerSystem.position, this.playerSystem.health);
      if (this.playerSystem.drivingCar) {
        this.overlay.updateSpeedo(this.vehicleSystem?.getSpeedKmh?.() || 0);
      }
      this.overlay.sceneBeacon = (stranded, distance) => {
        this.sceneSystem.setBeaconFocus(stranded, distance);
      };
      this.overlay.updateReturnBeacon(
        this.playerSystem.position,
        this.sceneSystem.camera,
        this.playerSystem.returnSpeed || this.playerSystem.maxSpeed
      );
      if (!this.overlay.stranded) {
        this.sceneSystem.setBeaconFocus(false, this.playerSystem.position.length());
      }
    }

    this.sweepExpiredLinks?.();
    updateGraffitiLinks(this.worldSystem?.objects, this.sceneSystem.camera);

    // 6. Render Frame
    this.sceneSystem.renderer.render(this.sceneSystem.scene, this.sceneSystem.camera);
  }
}

// Bootstrap application on window load
window.addEventListener("DOMContentLoaded", () => {
  const app = new OpenSpaceApp();
  window.multiverseApp = app;
  app.start();
});
