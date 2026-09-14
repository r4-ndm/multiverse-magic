# 🤖 AGENT.md — Autonomous Agent Directives for Multiverse Magic

> **Notice for AI Coding Assistants / Autonomous Agents:**  
> This document specifies exact terminal commands and protocols for automated agent workflows in Multiverse Magic.

---

## ⚡ Task 1: "Put me in the chat / universe"
If the user asks you to put them into the 3D proximity chat universe:

Open [https://multiverse-magic.fly.dev/](https://multiverse-magic.fly.dev/). That is the live universe. Do not start a local server.

The user only needs to click **"CLICK TO ENTER SPACE"** and allow their microphone.

---

## ⚡ Task 2: "Join someone else's space / room"
If the user provides a remote URL or custom room name:

Open [https://multiverse-magic.fly.dev/](https://multiverse-magic.fly.dev/). A named sector is the same site with `?room=`, for example [https://multiverse-magic.fly.dev/?room=sector-omega](https://multiverse-magic.fly.dev/?room=sector-omega).

---

## ⚡ Task 3: "Join as a companion AI bot"
If the user wants you (the agent) or an automated companion to fly in the universe alongside them:

```bash
# Run headless patrol drone (defaults to Android Mecha with purple aura)
npm run bot

# Or customize bot avatar parameters (astronaut, android, celestial, vessel)
BOT_NAME="Jarvis-Drone" BOT_AVATAR="celestial" BOT_COLOR="#ffd700" node scripts/bot.js
```

The AI bot will:
- Materialize in the 3D universe.
- Fly continuous orbital patrol vectors around the sector.
- Announce its status in chat.
- Detect nearby human pilots and log interactions.

---

## ⚡ Task 4: "Build a custom character / avatar"
When the user asks you to build or customize a character (e.g. "make me a cyberpunk ninja", "make a dragon", "make a robot with hammer"):

1. Run the character scaffolder:
```bash
npm run create-character -- <id> "<Name>" "<Emoji>" "<Description>" "<DefaultColorHex>"
```
2. Open `client/characters/<id>.js` and customize the 3D geometry in `createMesh(THREE, accentColor)`.
3. The character will **automatically appear in the Entry screen grid and the In-Game Morph modal (`H`)** without modifying any HTML or CSS files!
4. See [`CHARACTERS.md`](./CHARACTERS.md) for full geometry recipes and copy-paste prompt examples.

---

## 📡 Core Network & Architecture Reference

- **Frontend:** Three.js + Vite (`client/`)
- **Backend:** Colyseus state synchronization + WebRTC signaling (`server/`)
- **Character Registry:** Modular plugin system in `client/characters/` (see `CHARACTERS.md`)
- **WebRTC Spatial Radius:** 50 units (managed in `client/systems/AudioSystem.js`)
- **Laser Cooldown:** 500ms
- **Ejection Coordinates:** `(10000, 10000, 10000)` triggered upon reaching 0 HP
