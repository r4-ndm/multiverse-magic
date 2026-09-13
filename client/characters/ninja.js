/**
 * Cyber Ninja (🥷)
 * Generated automatically for Multiverse Magic
 */
export const NinjaCharacter = {
  id: "ninja",
  name: "Cyber Ninja",
  emoji: "🥷",
  description: "Stealth Assassin",
  defaultColor: "#00ff66",

  createMesh(THREE, accentColor = 0x00ff66) {
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
