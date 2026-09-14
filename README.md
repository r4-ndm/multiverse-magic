# 🌌 Multiverse Magic

> **A Permissionless 3D Proximity Chat Universe**  
> *"Click a URL → Grant mic → You're in."*

Multiverse Magic is a browser-based, open-source 3D universe where anyone can join via a URL and immediately interact with others based on true 3D spatial voice proximity. No accounts, no passwords, no gatekeepers. The URL is the room.

**Play:** [https://multiverse-magic.fly.dev/](https://multiverse-magic.fly.dev/) 

Self-governing communities maintain order through in-game mechanics: trolls and bad actors can be shot, and upon sustaining critical damage, they are automatically **ejected into deep space** where their audio naturally cuts out and they must fly back manually.

---

## 🚀 Core Principles

1. **Zero Friction:** No signup, no login, no room creation forms. `?room=sector7` or the default room takes you directly into space.
2. **Permissionless:** Anyone can join any space. No admin approval.
3. **Peer-to-Peer 3D Spatial Audio:** WebRTC voice flows directly between browsers. The server handles only state synchronization and WebRTC signaling. Three.js `PositionalAudio` handles distance falloff and stereo panning in 3D.
4. **Self-Governing:** No moderators. The community uses in-game laser weapons to eject bad actors into deep space.
5. **Clean & Extensible:** Built on a modular `WorldObject` architecture that allows new celestial bodies, portals, clickable web links, and interactive structures to be added in under an hour.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **3D Rendering** | [Three.js](https://threejs.org/) | WebGL scene, starfield, nebulae, ship avatars, lasers, and particle effects. |
| **Multiplayer State Sync** | [Colyseus](https://colyseus.io/) (Node.js) | Server-authoritative room state, player positions, health, combat resolution, and ejection. |
| **P2P Audio** | WebRTC (`RTCPeerConnection`) | Peer-to-peer microphone streaming within a 50-unit proximity sphere. |
| **Spatial Audio** | Three.js `PositionalAudio` + Web Audio API | Attached to avatar meshes with realistic 3D distance rolloff and binaural/stereo panning. |
| **Server** | Node.js + Express + Colyseus | Single unified server for state synchronization and WebRTC SDP/ICE signaling. |
| **Client Bundling** | [Vite](https://vitejs.dev/) | Modern ESM bundling with hot module replacement and near-instant cold start. |
| **Character Models** | glTF (`.glb`) + Procedural Mesh Fallback | Scifi spacecraft with cockpit glow, swept wings, thruster lights, and billboard health bars. |

---

## 📁 File Structure

```text
openspace/
├── server/
│   ├── index.js              # Express HTTP + Colyseus WebSocket server
│   ├── rooms/
│   │   └── SpaceRoom.js      # Room logic: state sync, lasers, ejection, signaling
│   └── schema/
│       └── Player.js         # Player state schema (id, coords, rotation, health)
├── client/
│   ├── index.html            # WebGL viewport, HUD, crosshair, entry modal
│   ├── main.js               # Main orchestrator: scene loop, user entry, systems
│   ├── systems/
│   │   ├── SceneSystem.js    # Starfield (8,000+ stars), volumetric nebulae, lighting
│   │   ├── PlayerSystem.js   # Ship avatar, space inertia physics, chase camera
│   │   ├── NetworkSystem.js  # Colyseus connection, throttled sync (50ms)
│   │   ├── AudioSystem.js    # WebRTC P2P proximity voice + procedural SFX
│   │   ├── CombatSystem.js   # Raycasting, laser beams, muzzle flashes, hit sparks
│   │   └── WorldObject.js    # Extensible base class for planets, portals & stations
│   ├── ui/
│   │   └── Overlay.js        # Entry modal, health bar, alerts, deep space ejection
│   └── assets/
│       ├── models/
│       │   └── spaceship.glb # 3D glTF binary model for avatars
│       └── sounds/           # pew.wav, hit.wav, whoosh.wav, hum.wav
├── vite.config.js            # Vite build and dev server configuration
├── package.json              # Dependencies and run scripts
└── README.md                 # Project documentation
```

---

## 🕹️ Controls

| Control | Action |
| :--- | :--- |
| **Mouse** | Pitch and Yaw (Click canvas to enable Pointer Lock) |
| **W / S** | Forward / Backward Thrusters |
| **A / D** | Strafe Left / Right |
| **Space** | Ascend (Vertical Up) |
| **C / Shift** | Descend (Vertical Down) |
| **Left Click** | Fire Laser (500ms cooldown) |
| **M** | Toggle Microphone Mute / Unmute |
| **Escape** | Release Pointer Lock |

## 🤖 Agent-Friendly Quickstart ("Agent, put me in the chat")

Multiverse Magic is designed for autonomous coding agents (Antigravity, Cursor, Claude Code, Devin, etc.).

If your agent cloned this repo, you can simply tell your agent:
> *"Agent, put me in the chat."*

Open [https://multiverse-magic.fly.dev/](https://multiverse-magic.fly.dev/). That is the live universe. No local server.

See **[`AGENT.md`](./AGENT.md)** for full machine-readable directives and headless bot instructions.

---

## ⚡ Getting Started

Open [https://multiverse-magic.fly.dev/](https://multiverse-magic.fly.dev/). Click enter, allow the microphone, and you're in Open Space.

### Testing Multiplayer Proximity Voice
1. Open [https://multiverse-magic.fly.dev/](https://multiverse-magic.fly.dev/) in **Window 1**.
2. Open [https://multiverse-magic.fly.dev/](https://multiverse-magic.fly.dev/) in a **separate window or Incognito tab**.
3. Click **"CLICK TO ENTER SPACE"** in both windows and allow microphone permissions.
4. Fly the two ships close together (within 50 units). You will hear proximity voice chat in full 3D stereo!
5. Fly away from each other: voice audio smoothly attenuates and disconnects once beyond 50 units.
6. Left-click to fire lasers at the other ship. Each hit deals 10 damage with visual beams, hit sparks, and sound effects.
7. Deplete the target ship to 0 HP: the target will be violently ejected to coordinates `(10000, 10000, 10000)` with a whoosh sound and a universe-wide broadcast!

---

## 📡 Server Message Protocol

OpenSpace uses Colyseus messages for real-time interaction and signaling:

| Message Type | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `move` | Client → Server | `{ x, y, z, rotation, pitch }` | Throttled (every 50ms) position update. |
| `shoot` | Client → Server | `{ targetId, origin, direction, hitPoint }` | Fired laser. Enforces 500ms cooldown. |
| `shot_fired` | Server → Client | `{ shooterId, origin, direction, targetId, hitPoint }` | Broadcast to all clients to render laser beam and sound. |
| `hit` | Client → Server | `{ targetId }` | Confirmed raycast hit. |
| `player_hit` | Server → Client | `{ shooterId, targetId, damage, health }` | Broadcast damage update and trigger hit sparks. |
| `player_ejected` | Server → Client | `{ targetId, ejectionCoords, message }` | Broadcast when health reaches 0; resets target to (10000, 10000, 10000). |
| `signal` | Client ⇄ Server | `{ to, signal }` / `{ from, signal }` | WebRTC P2P signaling relay (SDP offer/answer, ICE candidates). |
| `chat` | Client ⇄ Server | `{ text }` / `{ senderId, text, timestamp }` | Text chat broadcast (IRC-like universe feed). |

---

## 🪐 Extensibility Guide: Adding a Planet or Portal in < 1 Hour

OpenSpace is engineered with modularity at its core. Future features (planets, portals, stations, clickable links) extend the `WorldObject` base class in `client/systems/WorldObject.js`:

```javascript
import * as THREE from "three";
import { WorldObject } from "./systems/WorldObject.js";

export class CyberStation extends WorldObject {
  constructor(id, position = new THREE.Vector3(0, 50, -100)) {
    super(id, "Orbital Station Alpha");
    this.isInteractive = true;
    this.interactionRadius = 25.0; // Distance to trigger interaction

    // 1. Build Three.js 3D Geometry
    const stationGeo = new THREE.TorusGeometry(12, 2.5, 16, 64);
    const stationMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.8,
      roughness: 0.2,
      wireframe: true,
    });
    this.mesh.add(new THREE.Mesh(stationGeo, stationMat));
    this.mesh.position.copy(position);
  }

  // 2. Animation / Tick Loop
  update(delta, time) {
    this.mesh.rotation.z += delta * 0.2;
  }

  // 3. Pilot Interaction Hook
  onInteract(playerSystem) {
    console.log("Pilot docked with Orbital Station Alpha!");
  }
}
```

### Registering in `main.js`:
```javascript
this.worldSystem.register(new CyberStation("alpha_station", new THREE.Vector3(50, 0, -200)));
```

---

## 🎯 Acceptance Criteria Verification

- [x] **Two users can open the same URL in separate browser windows and see each other's avatars.**
- [x] **Both users are prompted for microphone access on entry.**
- [x] **When avatars are within 50 units, they can hear each other's voice via WebRTC + Three.js PositionalAudio.**
- [x] **When avatars move apart, the audio fades and disconnects.**
- [x] **Movement feels smooth and space-like with customizable inertia and zero gravity.**
- [x] **The scene is a black void with 8,000+ stars and nebulae. No floor, no walls.**
- [x] **Left-clicking fires visible laser beams with muzzle flash and hit sparks.**
- [x] **Hitting another player's avatar reduces their health bar.**
- [x] **When health reaches 0, the player is teleported to deep space (10000, 10000, 10000) and health resets to 100.**
- [x] **The ejected player sees a deep space notification with distance counter, and other players receive the broadcast.**
- [x] **Proximity audio naturally disconnects for the ejected player.**
- [x] **Character and Avatar Customization:** Choose from Humanoid Astronaut, Cyber Mecha Android, Cosmic Celestial Being, Starfighter Vessel, or custom `.glb` 3D model with custom aura colors.
- [x] **Dynamic In-Universe Morphing:** Press `H` or click `MORPH` in HUD to seamlessly transmute your avatar in real-time across the network.
- [x] **Fully extensible architecture with `WorldObject` base class and documented server protocol.**

---

## 📄 License
MIT License. Built for the open metaverse.
