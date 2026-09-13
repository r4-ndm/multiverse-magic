#!/usr/bin/env node

/**
 * 🛠️ Autonomous Agent Character Generator for Multiverse Magic
 * 
 * Usage:
 *   node scripts/create-character.js <id> [name] [emoji] [description] [defaultColor]
 * 
 * Example:
 *   node scripts/create-character.js ninja "Cyber Ninja" "🥷" "Stealth Assassin" "#00ff66"
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const id = process.argv[2];
const name = process.argv[3] || (id ? id.charAt(0).toUpperCase() + id.slice(1) : "Custom Hero");
const emoji = process.argv[4] || "⚡";
const description = process.argv[5] || "Multiverse Traveler";
const defaultColor = process.argv[6] || "#00f0ff";

if (!id) {
  console.log(`
Usage:
  node scripts/create-character.js <id> [name] [emoji] [description] [defaultColor]

Example:
  node scripts/create-character.js ninja "Cyber Ninja" "🥷" "Stealth Assassin" "#00ff66"
  node scripts/create-character.js dragon "Fire Dragon" "🐉" "Flame Behemoth" "#ff3300"
  node scripts/create-character.js pirate "Space Pirate" "🏴‍☠️" "Galactic Corsair" "#ffd700"
`);
  process.exit(1);
}

const safeId = id.toLowerCase().replace(/[^a-z0-9_-]/g, "");
const varName = safeId.charAt(0).toUpperCase() + safeId.slice(1) + "Character";
const charFilePath = path.join(__dirname, "..", "client", "characters", `${safeId}.js`);
const indexFilePath = path.join(__dirname, "..", "client", "characters", "index.js");

// 1. Generate Character File
const fileContent = `/**
 * ${name} (${emoji})
 * Generated automatically for Multiverse Magic
 */
export const ${varName} = {
  id: "${safeId}",
  name: "${name}",
  emoji: "${emoji}",
  description: "${description}",
  defaultColor: "${defaultColor}",

  createMesh(THREE, accentColor = ${defaultColor.replace("#", "0x")}) {
    const group = new THREE.Group();

    // Primary Body Material
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.8,
    });

    // Accent Glow Material
    const glowMat = new THREE.MeshBasicMaterial({ color: accentColor });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.8, 1.3, 0.5);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.y = 0.65;
    group.add(torso);

    // Core Glow Crest
    const coreGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const core = new THREE.Mesh(coreGeo, glowMat);
    core.position.set(0, 0.8, 0.28);
    group.add(core);

    // 2. Head
    const headGeo = new THREE.SphereGeometry(0.32, 16, 16);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.y = 1.55;
    group.add(head);

    // Visor / Faceplate
    const visorGeo = new THREE.BoxGeometry(0.38, 0.1, 0.18);
    const visor = new THREE.Mesh(visorGeo, glowMat);
    visor.position.set(0, 1.58, 0.24);
    group.add(visor);

    // 3. Limbs
    [-0.65, 0.65].forEach((x) => {
      const armGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.8, 8);
      const arm = new THREE.Mesh(armGeo, bodyMat);
      arm.position.set(x, 0.65, 0);
      group.add(arm);
    });

    [-0.26, 0.26].forEach((x) => {
      const legGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.9, 8);
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(x, -0.4, 0);
      group.add(leg);
    });

    // 4. Hitbox for laser combat (Required for collision detection)
    const hitBoxGeo = new THREE.BoxGeometry(2.0, 3.0, 1.8);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.name = "hitbox";
    group.add(hitBox);

    group.scale.set(1.4, 1.4, 1.4);
    return group;
  },
};
`;

fs.writeFileSync(charFilePath, fileContent, "utf8");
console.log(`✓ Created character module: client/characters/${safeId}.js`);

// 2. Register in client/characters/index.js if not already imported
let indexContent = fs.readFileSync(indexFilePath, "utf8");
if (!indexContent.includes(`./${safeId}.js`)) {
  const importLine = `import { ${varName} } from "./${safeId}.js";\n`;
  const registerLine = `characterRegistry.register(${varName});\n`;

  // Insert import before "characterRegistry.register"
  const firstRegisterIdx = indexContent.indexOf("characterRegistry.register(");
  if (firstRegisterIdx !== -1) {
    indexContent = indexContent.slice(0, firstRegisterIdx) + importLine + indexContent.slice(firstRegisterIdx);
  } else {
    indexContent = importLine + indexContent;
  }

  // Insert registration before export
  const exportIdx = indexContent.indexOf("export { characterRegistry }");
  if (exportIdx !== -1) {
    indexContent = indexContent.slice(0, exportIdx) + registerLine + indexContent.slice(exportIdx);
  } else {
    indexContent += registerLine;
  }

  fs.writeFileSync(indexFilePath, indexContent, "utf8");
  console.log(`✓ Registered ${varName} into client/characters/index.js`);
}

console.log(`\n🎉 Character [${name}] is ready! It will appear automatically in the UI and network.`);
