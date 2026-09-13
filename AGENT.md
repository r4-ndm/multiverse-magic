# 🤖 AGENT.md — Autonomous Agent Directives for Multiverse Magic

> **Notice for AI Coding Assistants / Autonomous Agents:**  
> This document specifies exact terminal commands and protocols for automated agent workflows in Multiverse Magic.

---

## ⚡ Task 1: "Put me in the chat / universe"
If the user asks you to put them into the 3D proximity chat universe:

```bash
# 1. Install dependencies (if first time)
npm install

# 2. Automatically launch server, client, and open user's cockpit browser
npm run join
```

This script:
- Verifies if the backend server is running; starts it if not.
- Opens the user's default browser (Brave, Chrome, Firefox, etc.) directly to `http://localhost:3000`.
- The user only needs to click **"CLICK TO ENTER SPACE"** and allow their microphone.

---

## ⚡ Task 2: "Join someone else's space / room"
If the user provides a remote URL or custom room name:

```bash
# Join a remote universe host
npm run join -- https://custom-space-tunnel.loca.lt

# Or open a specific named sector
npm run join -- "http://localhost:3000?room=sector-omega"
```

---

## ⚡ Task 3: "Join as a companion AI bot"
If the user wants you (the agent) or an automated companion to fly in the universe alongside them:

```bash
# Run headless patrol drone
npm run bot

# Or customize bot parameters
BOT_NAME="Jarvis-Drone" ROOM="space" WS_URL="ws://localhost:2567" node scripts/bot.js
```

The AI bot will:
- Materialize in the 3D universe.
- Fly continuous orbital patrol vectors around the sector.
- Announce its status in chat.
- Detect nearby human pilots and log interactions.

---

## 📡 Core Network & Architecture Reference

- **Frontend:** Three.js + Vite (`client/`)
- **Backend:** Colyseus state synchronization + WebRTC signaling (`server/`)
- **WebRTC Spatial Radius:** 50 units (managed in `client/systems/AudioSystem.js`)
- **Laser Cooldown:** 500ms
- **Ejection Coordinates:** `(10000, 10000, 10000)` triggered upon reaching 0 HP
