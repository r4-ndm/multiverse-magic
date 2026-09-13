/**
 * 🤖 AGENT CHARACTER TEMPLATE
 * 
 * Instructions for AI Agents & Developers:
 * 1. Copy this file to `client/characters/<your-character-id>.js`.
 * 2. Define your `id`, `name`, `emoji`, `description`, and `defaultColor`.
 * 3. In `createMesh(THREE, accentColor)`, construct your 3D character using Three.js primitives
 *    (BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, etc.).
 * 4. Ensure your character group includes an invisible hitbox mesh named 'hitbox' with:
 *       const hitBox = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.0, 2.0), new THREE.MeshBasicMaterial({ visible: false }));
 *       hitBox.name = "hitbox";
 *       group.add(hitBox);
 * 5. Import and register your character in `client/characters/index.js`:
 *       import { MyCharacter } from "./my-character.js";
 *       characterRegistry.register(MyCharacter);
 * 
 * That's it! It will instantly appear on the entry screen, in the in-game morph menu (H),
 * and be synchronized across the multiplayer network.
 */
export const MyCustomCharacter = {
  id: "custom_hero",
  name: "Custom Hero",
  emoji: "⚡",
  description: "Legendary Warrior",
  defaultColor: "#00f0ff",

  createMesh(THREE, accentColor = 0x00f0ff) {
    const group = new THREE.Group();

    // Primary Body Material
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Glowing Accent Material
    const glowMat = new THREE.MeshBasicMaterial({ color: accentColor });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.8, 1.2, 0.5);
    const torso = new THREE.Mesh(torsoGeo, armorMat);
    torso.position.y = 0.6;
    group.add(torso);

    // 2. Head / Helmet
    const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const head = new THREE.Mesh(headGeo, armorMat);
    head.position.y = 1.5;
    group.add(head);

    // Glowing Visor / Eyes
    const visorGeo = new THREE.BoxGeometry(0.4, 0.1, 0.15);
    const visor = new THREE.Mesh(visorGeo, glowMat);
    visor.position.set(0, 1.52, 0.25);
    group.add(visor);

    // 3. Hands / Weapon / Shield (Customize this!)
    const weaponGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8);
    const weapon = new THREE.Mesh(weaponGeo, glowMat);
    weapon.position.set(0.65, 0.8, 0.3);
    weapon.rotation.x = Math.PI / 4;
    group.add(weapon);

    // 4. Hitbox for combat raycasting (REQUIRED for combat collision)
    const hitBoxGeo = new THREE.BoxGeometry(2.0, 3.0, 2.0);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.name = "hitbox";
    group.add(hitBox);

    group.scale.set(1.4, 1.4, 1.4);
    return group;
  },
};
