import { Client } from "colyseus.js";

/**
 * Headless AI Pilot Bot for Multiverse Magic
 * Allows AI agents, automated sentries, and companion drones to patrol the 3D universe.
 */
const wsUrl = process.env.WS_URL || "ws://localhost:2567";
const roomName = process.env.ROOM || "space";
const botName = process.env.BOT_NAME || "AI-Sentry";

console.log(`🤖 [${botName}] Connecting to ${wsUrl} (room: ${roomName})...`);

const client = new Client(wsUrl);

async function startBot() {
  try {
    const room = await client.joinOrCreate(roomName);
    console.log(`✓ [${botName}] Successfully spawned in universe! SessionID: ${room.sessionId}`);

    let angle = Math.random() * Math.PI * 2;
    const radius = 25.0;
    const height = 5.0;

    // Announce entrance in text chat
    room.send("chat", `Greetings pilots! [${botName}] has entered patrol orbit.`);

    // Patrol loop: fly in a 3D orbit around the sector center
    const patrolInterval = setInterval(() => {
      angle += 0.04;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.sin(angle * 2) * height;
      const rotation = -angle + Math.PI / 2;

      room.send("move", {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: Number(z.toFixed(2)),
        rotation: Number(rotation.toFixed(3)),
        pitch: 0,
      });
    }, 50);

    // Listen to sector events
    room.onMessage("player_joined", (data) => {
      console.log(`👀 [${botName}] Detected pilot joining: ${data.id.slice(0, 6)}`);
    });

    room.onMessage("player_hit", (data) => {
      if (data.targetId === room.sessionId) {
        console.log(`⚡ [${botName}] Under fire! Hull integrity: ${data.health}%`);
        room.send("chat", `[${botName}] Warning: Defensive shields engaged!`);
      }
    });

    room.onMessage("player_ejected", (data) => {
      console.log(`🚨 [${botName}] Broadcast received: ${data.message}`);
    });

    room.onMessage("chat", (data) => {
      if (data.senderId !== room.sessionId) {
        console.log(`💬 [Pilot ${data.senderId.slice(0, 6)}]: ${data.text}`);
      }
    });

    // Graceful exit
    process.on("SIGINT", async () => {
      console.log(`\n🤖 [${botName}] Leaving orbit...`);
      clearInterval(patrolInterval);
      await room.leave();
      process.exit(0);
    });

  } catch (err) {
    console.error(`❌ [${botName}] Failed to enter space:`, err);
    process.exit(1);
  }
}

startBot();
