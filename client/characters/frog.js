/**
 * Cosmic Frog (🐸) - Void Hopper
 * Galactic Amphibian wielding the Cosmic Lilypad Scepter
 */
export const FrogCharacter = {
  id: "frog",
  aliases: ["cosmic_frog", "toad"],
  name: "Cosmic Frog",
  emoji: "🐸",
  description: "Void Hopper",
  defaultColor: "#00ff88",

  createMesh(THREE, accentColor = 0x00ff88) {
    const group = new THREE.Group();

    // 1. Materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a, // Vibrant Emerald Frog Green
      roughness: 0.35,
      metalness: 0.2,
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0x86efac, // Creamy Mint Bioluminescent Belly
      roughness: 0.45,
      metalness: 0.1,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.85,
      roughness: 0.2,
    });
    const techMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.75,
      roughness: 0.3,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a, // Glowing Cosmic Golden Sclera
      roughness: 0.2,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0f1d });

    // 2. Torso / Body (Chubby Space Frog)
    const bodyGeo = new THREE.SphereGeometry(0.68, 16, 16);
    bodyGeo.scale(1.18, 0.88, 1.05);
    const body = new THREE.Mesh(bodyGeo, skinMat);
    body.position.y = 0.55;
    group.add(body);

    // Glowing Bioluminescent Belly
    const bellyGeo = new THREE.SphereGeometry(0.54, 14, 14);
    bellyGeo.scale(0.92, 0.82, 0.42);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, 0.5, 0.42);
    group.add(belly);

    // Cosmic Star Rune on Chest
    const runeGeo = new THREE.OctahedronGeometry(0.12);
    const rune = new THREE.Mesh(runeGeo, glowMat);
    rune.position.set(0, 0.58, 0.62);
    group.add(rune);

    // 3. Head & Wide Amphibian Smile
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.15, 0.08);

    const headGeo = new THREE.SphereGeometry(0.58, 16, 16);
    headGeo.scale(1.28, 0.72, 1.12);
    const head = new THREE.Mesh(headGeo, skinMat);
    headGroup.add(head);

    // Wide Smiling Mouth Ridge
    const mouthGeo = new THREE.TorusGeometry(0.46, 0.032, 8, 18, Math.PI * 0.75);
    const mouth = new THREE.Mesh(mouthGeo, techMat);
    mouth.rotation.x = Math.PI / 1.7;
    mouth.rotation.z = -Math.PI * 0.375;
    mouth.position.set(0, -0.06, 0.45);
    headGroup.add(mouth);

    // Nostril dimples
    [-0.08, 0.08].forEach((x) => {
      const nosGeo = new THREE.SphereGeometry(0.035, 6, 6);
      const nos = new THREE.Mesh(nosGeo, techMat);
      nos.position.set(x, 0.12, 0.58);
      headGroup.add(nos);
    });

    // 4. Large Bulbous Cosmic Eyes
    [-0.38, 0.38].forEach((x) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(x, 0.32, 0.18);

      // Outer green bulbous socket
      const socketGeo = new THREE.SphereGeometry(0.24, 14, 14);
      const socket = new THREE.Mesh(socketGeo, skinMat);
      eyeGroup.add(socket);

      // Eye sclera
      const eyeGeo = new THREE.SphereGeometry(0.19, 14, 14);
      const eye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
      eye.position.set(0, 0.04, 0.06);
      eyeGroup.add(eye);

      // Glowing cosmic iris
      const irisGeo = new THREE.SphereGeometry(0.11, 10, 10);
      const iris = new THREE.Mesh(irisGeo, glowMat);
      iris.position.set(0, 0.04, 0.18);
      eyeGroup.add(iris);

      // Horizontal frog pupil slit
      const pupilGeo = new THREE.BoxGeometry(0.12, 0.036, 0.04);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0, 0.04, 0.26);
      eyeGroup.add(pupil);

      headGroup.add(eyeGroup);
    });

    // 5. Transparent Astronaut Bubble Helmet
    const bubbleGeo = new THREE.SphereGeometry(0.85, 24, 24);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0xa7f3d0,
      transparent: true,
      opacity: 0.28,
      roughness: 0.08,
      metalness: 0.15,
      depthWrite: false,
    });
    const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    bubble.position.set(0, 0.08, 0.02);
    headGroup.add(bubble);

    // Golden Helmet Collar Seal Ring
    const collarGeo = new THREE.TorusGeometry(0.68, 0.05, 8, 24);
    const collar = new THREE.Mesh(collarGeo, goldMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, -0.32, 0);
    headGroup.add(collar);

    group.add(headGroup);

    // 6. Frog Hopper Back Legs & Webbed Feet
    [-0.56, 0.56].forEach((x) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(x, 0.35, -0.15);

      // Upper muscular thigh angled back & out
      const thighGeo = new THREE.CylinderGeometry(0.22, 0.16, 0.52, 8);
      const thigh = new THREE.Mesh(thighGeo, skinMat);
      thigh.rotation.set(0.45, 0, x > 0 ? -0.4 : 0.4);
      legGroup.add(thigh);

      // Lower shin folded forward
      const shinGeo = new THREE.CylinderGeometry(0.15, 0.12, 0.5, 8);
      const shin = new THREE.Mesh(shinGeo, skinMat);
      shin.position.set(x > 0 ? 0.05 : -0.05, -0.32, 0.18);
      shin.rotation.set(-0.6, 0, x > 0 ? 0.2 : -0.2);
      legGroup.add(shin);

      // Wide Webbed Foot
      const footGeo = new THREE.BoxGeometry(0.38, 0.08, 0.52);
      const foot = new THREE.Mesh(footGeo, skinMat);
      foot.position.set(x > 0 ? 0.08 : -0.08, -0.56, 0.38);
      foot.rotation.x = 0.1;
      legGroup.add(foot);

      // Webbed Toe Claws
      [-0.1, 0, 0.1].forEach((toex) => {
        const toeGeo = new THREE.ConeGeometry(0.04, 0.16, 6);
        toeGeo.rotateX(Math.PI / 2);
        const toe = new THREE.Mesh(toeGeo, glowMat);
        toe.position.set((x > 0 ? 0.08 : -0.08) + toex, -0.56, 0.65);
        legGroup.add(toe);
      });

      group.add(legGroup);
    });

    // 7. Arms: Left waving, Right holding the Cosmic Lilypad Scepter
    // Left Arm
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.58, 0.72, 0.12);
    leftArmGroup.rotation.set(0.2, 0.1, 0.35);

    const lArmGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.55, 8);
    const lArm = new THREE.Mesh(lArmGeo, skinMat);
    lArm.position.y = -0.25;
    leftArmGroup.add(lArm);

    // Left Webbed Hand
    const lHandGeo = new THREE.BoxGeometry(0.24, 0.06, 0.28);
    const lHand = new THREE.Mesh(lHandGeo, skinMat);
    lHand.position.set(0, -0.55, 0.08);
    leftArmGroup.add(lHand);

    group.add(leftArmGroup);

    // Right Arm (Wielding Scepter / Laser Origin)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.58, 0.72, 0.15);
    rightArmGroup.rotation.set(-0.35, -0.1, -0.2);

    const rArmGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.55, 8);
    const rArm = new THREE.Mesh(rArmGeo, skinMat);
    rArm.position.y = -0.25;
    rightArmGroup.add(rArm);

    // Cosmic Lilypad Scepter
    const scepterGroup = new THREE.Group();
    scepterGroup.position.set(0.05, -0.3, 0.45);
    scepterGroup.rotation.set(0.4, 0.15, -0.1);

    // Staff shaft
    const shaftGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8);
    const shaft = new THREE.Mesh(shaftGeo, goldMat);
    scepterGroup.add(shaft);

    // Lilypad head
    const padGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.04, 16);
    const pad = new THREE.Mesh(padGeo, skinMat);
    pad.position.y = 0.48;
    scepterGroup.add(pad);

    const padRimGeo = new THREE.TorusGeometry(0.26, 0.025, 8, 20);
    padRimGeo.rotateX(Math.PI / 2);
    const padRim = new THREE.Mesh(padRimGeo, glowMat);
    padRim.position.y = 0.48;
    scepterGroup.add(padRim);

    // Glowing Star Focus Crystal at Scepter Tip
    const starGeo = new THREE.OctahedronGeometry(0.12);
    const star = new THREE.Mesh(starGeo, glowMat);
    star.position.y = 0.65;
    scepterGroup.add(star);

    // Scepter energy light
    const scepterLight = new THREE.PointLight(accentColor, 2.0, 6);
    scepterLight.position.y = 0.65;
    scepterGroup.add(scepterLight);

    rightArmGroup.add(scepterGroup);
    group.add(rightArmGroup);

    // 8. Back-Mounted Plasma Hopper Jetpack
    const jetGroup = new THREE.Group();
    jetGroup.position.set(0, 0.65, -0.52);

    const packMountGeo = new THREE.BoxGeometry(0.5, 0.4, 0.15);
    const packMount = new THREE.Mesh(packMountGeo, techMat);
    jetGroup.add(packMount);

    [-0.18, 0.18].forEach((x) => {
      // Warp Plasma Tank
      const tankGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.55, 12);
      const tank = new THREE.Mesh(tankGeo, techMat);
      tank.position.set(x, 0, 0.08);
      jetGroup.add(tank);

      // Glowing plasma level ring
      const pRingGeo = new THREE.TorusGeometry(0.105, 0.02, 6, 16);
      pRingGeo.rotateX(Math.PI / 2);
      const pRing = new THREE.Mesh(pRingGeo, glowMat);
      pRing.position.set(x, 0, 0.08);
      jetGroup.add(pRing);

      // Exhaust Nozzle
      const nozzleGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.16, 8);
      const nozzle = new THREE.Mesh(nozzleGeo, goldMat);
      nozzle.position.set(x, -0.32, 0.08);
      jetGroup.add(nozzle);

      // Plasma Thruster Flame
      const flameGeo = new THREE.ConeGeometry(0.07, 0.28, 8);
      flameGeo.rotateX(Math.PI);
      const flame = new THREE.Mesh(flameGeo, glowMat);
      flame.position.set(x, -0.5, 0.08);
      jetGroup.add(flame);
    });

    group.add(jetGroup);

    // 9. Floating Cosmic Lilypad Disc (Hover Base)
    const hoverPadGroup = new THREE.Group();
    hoverPadGroup.position.set(0, -0.22, 0);

    const discGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.035, 24);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.3,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    hoverPadGroup.add(disc);

    const discRimGeo = new THREE.TorusGeometry(0.96, 0.03, 8, 32);
    discRimGeo.rotateX(Math.PI / 2);
    const discRim = new THREE.Mesh(discRimGeo, glowMat);
    hoverPadGroup.add(discRim);

    // Orbiting Cosmic Fireflies / Star Dust
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const moteGeo = new THREE.OctahedronGeometry(0.06);
      const mote = new THREE.Mesh(moteGeo, glowMat);
      mote.position.set(Math.cos(angle) * 1.15, 0.15 + (i % 2) * 0.2, Math.sin(angle) * 1.15);
      hoverPadGroup.add(mote);
    }

    group.add(hoverPadGroup);

    // 10. Combat Hitbox (Required for laser hit detection)
    const hitBoxGeo = new THREE.BoxGeometry(2.0, 2.8, 2.0);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.name = "hitbox";
    group.add(hitBox);

    group.scale.set(1.35, 1.35, 1.35);
    return group;
  },
};
