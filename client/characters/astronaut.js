/**
 * 3D Humanoid Astronaut / Space Explorer.
 */
export const AstronautCharacter = {
  id: "astronaut",
  name: "Astronaut",
  emoji: "🧑‍🚀",
  description: "Humanoid Explorer",
  defaultColor: "#00f0ff",

  createMesh(THREE, accentColor = 0x00f0ff) {
    const group = new THREE.Group();

    // 1. Torso Space Suit
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.4,
      metalness: 0.1,
    });
    const torsoGeo = new THREE.CylinderGeometry(0.55, 0.45, 1.3, 10);
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.y = 0.65;
    group.add(torso);

    // Chest control unit
    const chestGeo = new THREE.BoxGeometry(0.4, 0.45, 0.2);
    const chestMat = new THREE.MeshStandardMaterial({
      color: 0x222630,
      metalness: 0.6,
      roughness: 0.2,
    });
    const chest = new THREE.Mesh(chestGeo, chestMat);
    chest.position.set(0, 0.8, 0.35);
    group.add(chest);

    // 2. Helmet & Gold Visor
    const helmetGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const helmet = new THREE.Mesh(helmetGeo, suitMat);
    helmet.position.y = 1.6;
    group.add(helmet);

    // Reflective Gold/Cyan Visor
    const visorGeo = new THREE.SphereGeometry(0.38, 16, 16);
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.4,
      metalness: 0.95,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.6, 0.22);
    visor.scale.set(1.0, 0.75, 0.85);
    group.add(visor);

    // 3. Life-support Jetpack (Backpack)
    const packGeo = new THREE.BoxGeometry(0.8, 1.1, 0.4);
    const pack = new THREE.Mesh(packGeo, chestMat);
    pack.position.set(0, 0.75, -0.42);
    group.add(pack);

    // Dual micro-thrusters on jetpack
    [-0.24, 0.24].forEach((xOffset) => {
      const jetGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.35, 8);
      jetGeo.rotateX(Math.PI / 2);
      const jetMat = new THREE.MeshBasicMaterial({ color: accentColor });
      const jet = new THREE.Mesh(jetGeo, jetMat);
      jet.position.set(xOffset, 0.35, -0.6);
      group.add(jet);
    });

    // 4. Arms with Suit Rings
    [-0.75, 0.75].forEach((xOffset) => {
      const armGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.9, 8);
      const arm = new THREE.Mesh(armGeo, suitMat);
      arm.position.set(xOffset, 0.65, 0);
      arm.rotation.z = xOffset > 0 ? -0.2 : 0.2;
      group.add(arm);

      const gloveGeo = new THREE.SphereGeometry(0.18, 8, 8);
      const glove = new THREE.Mesh(gloveGeo, chestMat);
      glove.position.set(xOffset * 1.15, 0.15, 0);
      group.add(glove);
    });

    // 5. Legs & Heavy Boots
    [-0.3, 0.3].forEach((xOffset) => {
      const legGeo = new THREE.CylinderGeometry(0.2, 0.18, 1.0, 8);
      const leg = new THREE.Mesh(legGeo, suitMat);
      leg.position.set(xOffset, -0.3, 0);
      group.add(leg);

      const bootGeo = new THREE.BoxGeometry(0.26, 0.2, 0.38);
      const boot = new THREE.Mesh(bootGeo, chestMat);
      boot.position.set(xOffset, -0.8, 0.06);
      group.add(boot);
    });

    // Hitbox for combat raycasting
    const hitBoxGeo = new THREE.BoxGeometry(2.0, 2.8, 1.8);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.name = "hitbox";
    group.add(hitBox);

    group.scale.set(1.4, 1.4, 1.4);
    return group;
  },
};
