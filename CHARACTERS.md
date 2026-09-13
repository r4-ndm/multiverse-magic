# 🎭 Custom Character Guide — Multiverse Magic

> **"Instruct your agent to build any character you can imagine."**

In Multiverse Magic, avatars are not limited to predefined models or vessels. Anyone can create completely unique 3D characters—from **Cyber Samurai** to **Mythical Dragons**, **Voxel Golems**, or **Cosmic Deities**—in **under 60 seconds** using modular ES modules and Three.js procedural geometries.

---

## 💬 Copy & Paste Prompts for Your AI Agent

Simply copy any of these prompts and give it to your AI agent (Antigravity, Claude, Cursor, Copilot, ChatGPT, etc.):

### 1. Cyberpunk Samurai with Dual Katanas
> *"Agent, create a new character in `client/characters/samurai.js` named 'Cyber Samurai' (emoji: 🥷, color: #00ff88). Give it angular carbon-fiber samurai armor, a kabuto helmet with a glowing crest, and two back-sheathed energy katanas with cyan plasma edges."*

### 2. Mythical Fire Dragon
> *"Agent, build a 3D character in `client/characters/dragon.js` called 'Fire Dragon' (emoji: 🐉, color: #ff3300). Give it a serpent/draconic head with glowing amber horns, bat-like wings, an emissive flame core in its chest, and a barbed tail."*

### 3. Steampunk Clockwork Robot
> *"Agent, make a character in `client/characters/clockwork.js` called 'Clockwork Golem' (emoji: ⚙️, color: #ffd700). Construct it with brass plating, exposed spinning gear rings, a monocle lens eye, and a steam exhaust chimney on its back."*

### 4. Necromancer / Dark Sorcerer
> *"Agent, create a character in `client/characters/necromancer.js` named 'Necromancer' (emoji: 💀, color: #00ffaa). Give it dark tattered robes, a floating skull with glowing green eye sockets, and an eerie bone staff."*

---

## ⚡ How It Works (For Autonomous Agents)

Multiverse Magic uses a **Zero-Friction Character Plugin System**. When an agent adds a character file to `client/characters/`:
1. It is automatically registered in `client/characters/index.js`.
2. The UI **dynamically discovers** it and creates cards on the Entry Screen and in the In-Game Morph Drawer (`H`).
3. The multiplayer network automatically synchronizes the new model across all connected pilots.
4. **No HTML or CSS modifications are required.**

---

## 🛠️ Instant Scaffolding CLI

You or your agent can scaffold a new character with a single command:

```bash
npm run create-character -- <id> [name] [emoji] [description] [defaultColor]
```

### Examples:
```bash
# Create a Cyber Ninja
npm run create-character -- ninja "Cyber Ninja" "🥷" "Stealth Assassin" "#00ff66"

# Create a Phoenix
npm run create-character -- phoenix "Solar Phoenix" "🔥" "Reborn Sun Bird" "#ffaa00"

# Create a Mech Suit
npm run create-character -- titan "Titan Mech" "🦾" "Heavy Assault Armor" "#00f0ff"
```

This generates `client/characters/<id>.js` and automatically registers it in `client/characters/index.js`. Your agent can then customize the geometry!

---

## 📐 Anatomy of a Character Module

Each character file in `client/characters/` is a self-contained module:

```javascript
/**
 * client/characters/samurai.js
 */
export const SamuraiCharacter = {
  id: "samurai",               // Unique slug
  name: "Cyber Samurai",       // Display name
  emoji: "🥷",                 // UI Icon
  description: "Dual Katanas", // Brief flavor text
  defaultColor: "#00ff88",     // Default accent/aura color

  createMesh(THREE, accentColor = 0x00ff88) {
    const group = new THREE.Group();

    // 1. Define Materials
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.85,
      roughness: 0.25,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: accentColor });

    // 2. Build 3D Geometries
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.5), armorMat);
    torso.position.y = 0.6;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), armorMat);
    head.position.y = 1.5;
    group.add(head);

    // 3. Add Weapons, Wings, or Props
    const katana = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.4, 0.08), glowMat);
    katana.position.set(0.4, 1.0, -0.3);
    katana.rotation.z = Math.PI / 4;
    group.add(katana);

    // 4. CRITICAL: Add Combat Hitbox for Lasers & Raycasting
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 3.2, 1.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.name = "hitbox";
    group.add(hitBox);

    group.scale.set(1.4, 1.4, 1.4);
    return group;
  },
};
```

---

## 🌐 External 3D Models (.GLB / ReadyPlayerMe)

If you prefer external 3D models rather than procedural meshes:
1. Copy the public URL to any `.glb` or `.gltf` model (from [ReadyPlayerMe](https://readyplayer.me), [Sketchfab](https://sketchfab.com), or your own server).
2. Paste the URL into the **"CUSTOM 3D AVATAR (.GLB URL)"** box on entry or inside the **`H`** morph menu.
3. The engine automatically loads, normalizes, and attaches your nametag and spatial audio to the custom model!

---

## 🎮 Switching Forms In-Game

You don't need to refresh to test or switch your character:
- Press **`H`** on your keyboard at any time while flying.
- Or click the **`🎭 MORPH [H]`** button on the top HUD.
- Pick your character, choose your aura color, and click **`TRANSMUTE`**.
