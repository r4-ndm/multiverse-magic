/**
 * Purple Wizard wielding Thor's Hammer (Mjölnir)
 */
export const WizardCharacter = {
  id: "wizard",
  name: "Wizard",
  emoji: "🧙‍♂️",
  description: "Thor's Hammer",
  defaultColor: "#9d00ff",

  createMesh(THREE, accentColor = 0x9d00ff) {
    const group = new THREE.Group();

    // 1. Wizard Robes (Royal Purple)
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0x4a148c,
      roughness: 0.6,
      metalness: 0.1,
    });
    const mantleMat = new THREE.MeshStandardMaterial({
      color: 0x311b92,
      roughness: 0.5,
      metalness: 0.15,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.85,
      roughness: 0.25,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const lightningMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff }); // Electric Cyan

    // Flared Robe Body
    const robeGeo = new THREE.CylinderGeometry(0.38, 0.72, 1.5, 12);
    const robe = new THREE.Mesh(robeGeo, robeMat);
    robe.position.y = 0.5;
    group.add(robe);

    // Shoulder Mantle / Cloak
    const mantleGeo = new THREE.CylinderGeometry(0.62, 0.68, 0.38, 10);
    const mantle = new THREE.Mesh(mantleGeo, mantleMat);
    mantle.position.y = 1.15;
    group.add(mantle);

    // Golden Rune Belt & Buckle
    const beltGeo = new THREE.CylinderGeometry(0.44, 0.46, 0.12, 12);
    const belt = new THREE.Mesh(beltGeo, goldMat);
    belt.position.y = 0.75;
    group.add(belt);

    const buckleGeo = new THREE.BoxGeometry(0.18, 0.18, 0.14);
    const buckle = new THREE.Mesh(buckleGeo, glowMat);
    buckle.position.set(0, 0.75, 0.42);
    group.add(buckle);

    // 2. Head, Beard & Glowing Eyes
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.7 });
    const headGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.45;
    group.add(head);

    // Flowing Wizard Beard (silver-white)
    const beardMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5 });
    const beardGeo = new THREE.ConeGeometry(0.22, 0.7, 6);
    beardGeo.rotateX(Math.PI);
    const beard = new THREE.Mesh(beardGeo, beardMat);
    beard.position.set(0, 1.15, 0.22);
    group.add(beard);

    // Glowing Eyes peering under hat brim
    [-0.09, 0.09].forEach((x) => {
      const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
      const eye = new THREE.Mesh(eyeGeo, lightningMat);
      eye.position.set(x, 1.5, 0.24);
      group.add(eye);
    });

    // 3. Pointed Wizard Hat
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 1.62, 0);

    const brimGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.05, 16);
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0x6a1b9a,
      roughness: 0.4,
      metalness: 0.2,
    });
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.rotation.x = -0.1;
    hatGroup.add(brim);

    const hatBandGeo = new THREE.CylinderGeometry(0.48, 0.52, 0.12, 12);
    const hatBand = new THREE.Mesh(hatBandGeo, goldMat);
    hatBand.position.y = 0.08;
    hatGroup.add(hatBand);

    const coneGeo = new THREE.ConeGeometry(0.46, 1.25, 12);
    const cone = new THREE.Mesh(coneGeo, hatMat);
    cone.position.set(0, 0.65, -0.08);
    cone.rotation.x = -0.16;
    hatGroup.add(cone);

    const tipGeo = new THREE.ConeGeometry(0.18, 0.45, 8);
    const tip = new THREE.Mesh(tipGeo, hatMat);
    tip.position.set(0, 1.3, -0.25);
    tip.rotation.x = -0.45;
    hatGroup.add(tip);

    group.add(hatGroup);

    // 4. Arms & Sleeves
    // Left Arm: Billowing sleeve in casting pose
    const leftArmGeo = new THREE.CylinderGeometry(0.18, 0.26, 0.85, 8);
    const leftArm = new THREE.Mesh(leftArmGeo, mantleMat);
    leftArm.position.set(-0.65, 0.95, 0.2);
    leftArm.rotation.set(0.3, 0, 0.4);
    group.add(leftArm);

    // Left hand arcane spell orb
    const spellOrbGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const spellOrb = new THREE.Mesh(spellOrbGeo, glowMat);
    spellOrb.position.set(-0.85, 1.25, 0.4);
    group.add(spellOrb);

    // Right Arm: Reaching forward wielding Thor's Hammer
    const rightArmGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.8, 8);
    const rightArm = new THREE.Mesh(rightArmGeo, mantleMat);
    rightArm.position.set(0.62, 0.85, 0.25);
    rightArm.rotation.set(-0.5, 0, -0.3);
    group.add(rightArm);

    // 5. THOR'S HAMMER (MJÖLNIR)
    const hammerGroup = new THREE.Group();
    hammerGroup.position.set(0.78, 0.85, 0.75);
    hammerGroup.rotation.set(0.2, 0.3, -0.4);

    const uruMat = new THREE.MeshStandardMaterial({
      color: 0x85929e,
      metalness: 0.92,
      roughness: 0.18,
    });
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x4e342e,
      roughness: 0.75,
      metalness: 0.1,
    });

    // Mjölnir Hammer Head
    const headBlockGeo = new THREE.BoxGeometry(0.52, 0.34, 0.34);
    const headBlock = new THREE.Mesh(headBlockGeo, uruMat);
    headBlock.position.y = 0.38;
    hammerGroup.add(headBlock);

    [-0.27, 0.27].forEach((x) => {
      const faceGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.06, 8);
      faceGeo.rotateZ(Math.PI / 2);
      const face = new THREE.Mesh(faceGeo, uruMat);
      face.position.set(x, 0.38, 0);
      hammerGroup.add(face);
    });

    // Carved Nordic Runes
    const runeGeo = new THREE.BoxGeometry(0.38, 0.06, 0.36);
    const rune = new THREE.Mesh(runeGeo, lightningMat);
    rune.position.set(0, 0.38, 0);
    hammerGroup.add(rune);

    // Hammer Handle
    const handleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.55, 8);
    const handle = new THREE.Mesh(handleGeo, leatherMat);
    handle.position.y = 0.05;
    hammerGroup.add(handle);

    for (let i = -1; i <= 1; i++) {
      const ringGeo = new THREE.TorusGeometry(0.05, 0.012, 6, 12);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, goldMat);
      ring.position.y = 0.05 + i * 0.12;
      hammerGroup.add(ring);
    }

    const pommelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8);
    const pommel = new THREE.Mesh(pommelGeo, uruMat);
    pommel.position.y = -0.23;
    hammerGroup.add(pommel);

    const strapGeo = new THREE.TorusGeometry(0.07, 0.016, 6, 12);
    const strap = new THREE.Mesh(strapGeo, leatherMat);
    strap.position.set(0, -0.3, 0);
    strap.rotation.x = Math.PI / 3;
    hammerGroup.add(strap);

    // Crackling Lightning Sparks
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const sparkGeo = new THREE.OctahedronGeometry(0.05 + Math.random() * 0.04);
      const spark = new THREE.Mesh(sparkGeo, lightningMat);
      spark.position.set(
        Math.cos(angle) * 0.28,
        0.38 + (Math.random() - 0.5) * 0.22,
        Math.sin(angle) * 0.28
      );
      hammerGroup.add(spark);
    }

    const hammerLight = new THREE.PointLight(0x00f0ff, 2.5, 8);
    hammerLight.position.set(0, 0.45, 0);
    hammerGroup.add(hammerLight);

    group.add(hammerGroup);

    // Hitbox for combat raycasting
    const hitBoxGeo = new THREE.BoxGeometry(2.0, 3.2, 1.8);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.name = "hitbox";
    group.add(hitBox);

    group.scale.set(1.4, 1.4, 1.4);
    return group;
  },
};
