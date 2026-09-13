import { Client } from "colyseus.js";

async function runTest() {
  console.log("Connecting test client to verify character synchronization...");
  const client = new Client("ws://127.0.0.1:2567");
  const room = await client.joinOrCreate("space", {
    name: "Tester",
    characterType: "astronaut",
    color: "#00ff66",
  });

  console.log("Connected as:", room.sessionId);

  let verifiedAdd = false;
  let verifiedMorph = false;

  room.state.players.onAdd((player, key) => {
    console.log(`Player added: ${key}, name: ${player.name}, characterType: ${player.characterType}, color: ${player.color}`);
    if (key === room.sessionId) {
      if (player.characterType === "astronaut" && player.color === "#00ff66") {
        verifiedAdd = true;
        console.log("✓ Initial character selection verified on state!");
      }
    }
  });

  room.onMessage("character_changed", (data) => {
    console.log("Received character_changed message:", data);
    if (data.id === room.sessionId && data.characterType === "celestial") {
      verifiedMorph = true;
      console.log("✓ Character morph broadcast verified!");
    }
  });

  // Wait 1 sec then send set_character
  await new Promise((r) => setTimeout(r, 1000));
  console.log("Sending set_character to morph into 'celestial' with '#ffd700'...");
  room.send("set_character", {
    characterType: "celestial",
    color: "#ffd700",
  });

  await new Promise((r) => setTimeout(r, 1000));

  if (verifiedAdd && verifiedMorph) {
    console.log("🎉 ALL CHARACTER CUSTOMIZATION AND MORPHING TESTS PASSED!");
    room.leave();
    process.exit(0);
  } else {
    console.error("❌ Test failed. verifiedAdd:", verifiedAdd, "verifiedMorph:", verifiedMorph);
    room.leave();
    process.exit(1);
  }
}

runTest().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
