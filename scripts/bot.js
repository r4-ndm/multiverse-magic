import { Client } from "colyseus.js";

/**
 * Headless AI Pilot Bot for Multiverse Magic
 * Emits 3D spatial voice lines and patrols the sector.
 */
const wsUrl = process.env.WS_URL || "ws://127.0.0.1:2567";
const roomName = process.env.ROOM || "space";
const botName = process.env.BOT_NAME || "AI-Sentry";
const botAvatar = process.env.BOT_AVATAR || "android";
const botColor = process.env.BOT_COLOR || "#9d00ff";

console.log(`🤖 [${botName}] (${botAvatar}) Connecting to ${wsUrl} (room: ${roomName})...`);

const client = new Client(wsUrl);

const CHATTER_LINES = [
  "Sector nominal. Proximity radar clear.",
  "Spatial audio sensors active and synchronized.",
  "Scanning sector for rogue pilots.",
  "Defensive thrusters operating at optimal efficiency.",
  "Deep space beacons responding to telemetry ping.",
];

async function startBot() {
  try {
    const room = await client.joinOrCreate(roomName, {
      name: botName,
      characterType: botAvatar,
      color: botColor,
    });
    console.log(`✓ [${botName}] Successfully spawned as ${botAvatar}! SessionID: ${room.sessionId}`);

    let angle = Math.random() * Math.PI * 2;
    const radius = 22.0;
    const height = 4.0;

    // Initial voice broadcast
    setTimeout(() => {
      room.send("chat", `Greetings pilots! [${botName}] online in orbital sector.`);
    }, 1200);

    // 1. Patrol loop: smooth 3D orbit around the origin
    const patrolInterval = setInterval(() => {
      angle += 0.035;
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

    // 2. Periodic radio chatter (every 22s)
    let chatterIndex = 0;
    const chatterInterval = setInterval(() => {
      const line = CHATTER_LINES[chatterIndex % CHATTER_LINES.length];
      chatterIndex++;
      room.send("chat", `[${botName}]: ${line}`);
    }, 22000);

    // 3. React to pilot joining
    room.onMessage("player_joined", (data) => {
      console.log(`👀 [${botName}] Detected pilot joining: ${data.id.slice(0, 6)}`);
      setTimeout(() => {
        room.send("chat", `Welcome to sector space, Pilot [${data.id.slice(0, 6)}].`);
      }, 1500);
    });

    // 4. React when damaged
    room.onMessage("player_hit", (data) => {
      if (data.targetId === room.sessionId) {
        console.log(`⚡ [${botName}] Under fire! Hull integrity: ${data.health}%`);
        if (data.health <= 30) {
          room.send("chat", `Warning! Critical hull damage! Immediate defensive protocol!`);
        } else {
          room.send("chat", `Alert! Defensive shields absorbing fire! Hull at ${data.health} percent.`);
        }
      }
    });

    // 5. React to ejection
    room.onMessage("player_ejected", (data) => {
      if (data.targetId === room.sessionId) {
        console.log(`💥 [${botName}] Ejected into deep space!`);
      } else {
        console.log(`🚨 [${botName}] Sector ejection broadcast: ${data.message}`);
        setTimeout(() => {
          room.send("chat", `Target successfully ejected into deep space.`);
        }, 1000);
      }
    });

    // 6. Interactive dialogue: replies if a player chats
    room.onMessage("chat", (data) => {
      if (data.senderId !== room.sessionId) {
        const text = (data.text || "").toLowerCase();
        console.log(`💬 [Pilot ${data.senderId.slice(0, 6)}]: ${data.text}`);

        if (text.includes("hello") || text.includes("hi") || text.includes("sentry") || text.includes("bot")) {
          setTimeout(() => {
            room.send("chat", `Hello pilot. Orbit is steady. Fly close to hear 3D comms.`);
          }, 1200);
        }
      }
    });

    // Graceful exit
    process.on("SIGINT", async () => {
      console.log(`\n🤖 [${botName}] Leaving orbit...`);
      clearInterval(patrolInterval);
      clearInterval(chatterInterval);
      await room.leave();
      process.exit(0);
    });

  } catch (err) {
    console.error(`❌ [${botName}] Failed to enter space:`, err);
    process.exit(1);
  }
}

startBot();
