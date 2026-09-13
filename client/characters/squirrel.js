/**
 * Galactic Squirrel (🐿️) - Starlight Forager
 * Agile cosmic rodent wielding the Quantum Acorn Cannon
 */
export const SquirrelCharacter = {
  id: "squirrel",
  aliases: ["galactic_squirrel", "chipmunk"],
  name: "Galactic Squirrel",
  emoji: "🐿️",
  description: "Starlight Forager",
  defaultColor: "#ff9900",

  createMesh(THREE, accentColor = 0xff9900) {
    const group = new THREE.Group();

    // 1. Materials
    const furMat = new THREE.MeshStandardMaterial({
      color: 0xb45309, // Warm Chestnut Fur
      roughness: 0.65,
      metalness: 0.1,
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7, // Creamy Celestial Underbelly
      roughness: 0.6,
      metalness: 0.05,
    });
    const darkFurMat = new THREE.MeshStandardMaterial({
      color: 0x78350f, // Deep Russet Accent Fur
      roughness: 0.65,
      metalness: 0.1,
    });
    const techMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.25,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.88,
      roughness: 0.2,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x050811,
      roughness: 0.1,
      metalness: 0.9,
    });
    const eyeSparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const acornWoodMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.45,
      metalness: 0.2,
    });

    // 2. Torso & Cream Belly
    const bodyGeo = new THREE.SphereGeometry(0.55, 16, 16);
    bodyGeo.scale(0.95, 1.15, 0.95);
    const body = new THREE.Mesh(bodyGeo, furMat);
    body.position.y = 0.65;
    group.add(body);

    // Cream Belly Patch
    const bellyGeo = new THREE.SphereGeometry(0.42, 14, 14);
    bellyGeo.scale(0.8, 1.0, 0.45);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, 0.62, 0.36);
    group.add(belly);

    // Cosmic Star Harness & Belt
    const harnessGeo = new THREE.TorusGeometry(0.54, 0.035, 6, 20);
    harnessGeo.rotateX(Math.PI / 2);
    const harness = new THREE.Mesh(harnessGeo, techMat);
    harness.position.y = 0.45;
    group.add(harness);

    const buckleGeo = new THREE.OctahedronGeometry(0.09);
    const buckle = new THREE.Mesh(buckleGeo, glowMat);
    buckle.position.set(0, 0.45, 0.52);
    group.add(buckle);

    // 3. Head, Chubby Cheek Pouches, & Perky Ears
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.35, 0.12);

    // Main head sphere
    const headGeo = new THREE.SphereGeometry(0.46, 16, 16);
    headGeo.scale(1.05, 0.96, 1.02);
    const head = new THREE.Mesh(headGeo, furMat);
    headGroup.add(head);

    // Chubby Cheek Pouches (full of cosmic acorns!)
    [-0.26, 0.26].forEach((x) => {
      const cheekGeo = new THREE.SphereGeometry(0.24, 12, 12);
      cheekGeo.scale(1.1, 0.9, 0.9);
      const cheek = new THREE.Mesh(cheekGeo, bellyMat);
      cheek.position.set(x, -0.1, 0.22);
      headGroup.add(cheek);
    });

    // Cute Dark Snout / Muzzle
    const snoutGeo = new THREE.SphereGeometry(0.16, 12, 12);
    snoutGeo.scale(1.1, 0.8, 1.2);
    const snout = new THREE.Mesh(snoutGeo, bellyMat);
    snout.position.set(0, -0.08, 0.38);
    headGroup.add(snout);

    // Little black nose
    const noseGeo = new THREE.SphereGeometry(0.065, 8, 8);
    noseGeo.scale(1.2, 0.8, 1.0);
    const nose = new THREE.Mesh(noseGeo, techMat);
    nose.position.set(0, -0.04, 0.54);
    headGroup.add(nose);

    // Big glossy cosmic rodent eyes
    [-0.24, 0.24].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), eyeMat);
      eye.position.set(x, 0.08, 0.34);
      headGroup.add(eye);

      // Starlight twinkle in pupil
      const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), eyeSparkleMat);
      sparkle.position.set(x + (x > 0 ? 0.03 : -0.03), 0.12, 0.43);
      headGroup.add(sparkle);

      const sparkleSmall = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), glowMat);
      sparkleSmall.position.set(x, 0.04, 0.43);
      headGroup.add(sparkleSmall);
    });

    // Perky Upright Ears with Tufted Tips
    [-0.28, 0.28].forEach((x) => {
      const earGroup = new THREE.Group();
      earGroup.position.set(x, 0.42, -0.05);
      earGroup.rotation.set(-0.15, 0, x > 0 ? -0.25 : 0.25);

      const earGeo = new THREE.ConeGeometry(0.14, 0.38, 8);
      const ear = new THREE.Mesh(earGeo, furMat);
      earGroup.add(ear);

      const innerEarGeo = new THREE.ConeGeometry(0.09, 0.28, 8);
      const innerEar = new THREE.Mesh(innerEarGeo, bellyMat);
      innerEar.position.set(0, -0.02, 0.04);
      earGroup.add(innerEar);

      // Fluffy ear tuft at the tip
      const tuftGeo = new THREE.SphereGeometry(0.06, 6, 6);
      tuftGeo.scale(0.6, 1.4, 0.6);
      const tuft = new THREE.Mesh(tuftGeo, darkFurMat);
      tuft.position.y = 0.22;
      earGroup.add(tuft);

      headGroup.add(earGroup);
    });

    // Transparent Astronaut Bubble Helmet
    const helmetGeo = new THREE.SphereGeometry(0.74, 24, 24);
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      transparent: true,
      opacity: 0.25,
      roughness: 0.05,
      metalness: 0.1,
      depthWrite: false,
    });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.set(0, 0.05, 0.06);
    headGroup.add(helmet);

    // Golden Collar Seal Ring
    const collarGeo = new THREE.TorusGeometry(0.56, 0.04, 8, 24);
    collarGeo.rotateX(Math.PI / 2);
    const collar = new THREE.Mesh(collarGeo, goldMat);
    collar.position.set(0, -0.36, 0);
    headGroup.add(collar);

    group.add(headGroup);

    // 4. MAGNIFICENT BUSHY GIANT COSMIC TAIL
    // Sweeps up from lower back, arches over head with fluffy segments
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.3, -0.35);

    // Tail Base (curves back)
    const tBaseGeo = new THREE.SphereGeometry(0.32, 12, 12);
    tBaseGeo.scale(0.85, 1.2, 1.3);
    const tBase = new THREE.Mesh(tBaseGeo, darkFurMat);
    tBase.position.set(0, 0.25, -0.22);
    tBase.rotation.x = -0.4;
    tailGroup.add(tBase);

    // Mid Tail (Huge fluffy arch)
    const tMidGeo = new THREE.SphereGeometry(0.52, 14, 14);
    tMidGeo.scale(0.9, 1.5, 1.1);
    const tMid = new THREE.Mesh(tMidGeo, furMat);
    tMid.position.set(0, 0.85, -0.42);
    tMid.rotation.x = 0.2;
    tailGroup.add(tMid);

    // Tail Plume Top (Curling over back towards head)
    const tTopGeo = new THREE.SphereGeometry(0.48, 14, 14);
    tTopGeo.scale(0.85, 1.3, 1.0);
    const tTop = new THREE.Mesh(tTopGeo, furMat);
    tTop.position.set(0, 1.45, -0.28);
    tTop.rotation.x = 0.65;
    tailGroup.add(tTop);

    // Tail Plume Tip (Celestial Cream highlight)
    const tTipGeo = new THREE.SphereGeometry(0.34, 12, 12);
    tTipGeo.scale(0.8, 1.1, 0.9);
    const tTip = new THREE.Mesh(tTipGeo, bellyMat);
    tTip.position.set(0, 1.82, -0.06);
    tTip.rotation.x = 0.95;
    tailGroup.add(tTip);

    // Orbiting Starlight Motes along Tail
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const starMote = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), glowMat);
      starMote.position.set(
        Math.cos(angle) * 0.45,
        0.8 + i * 0.22,
        -0.35 + Math.sin(angle) * 0.35
      );
      tailGroup.add(starMote);
    }

    group.add(tailGroup);

    // 5. Crouched Hind Legs & Paws
    [-0.38, 0.38].forEach((x) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(x, 0.4, -0.05);

      // Thigh
      const thighGeo = new THREE.SphereGeometry(0.26, 10, 10);
      thighGeo.scale(0.9, 1.2, 1.2);
      const thigh = new THREE.Mesh(thighGeo, furMat);
      thigh.rotation.x = 0.3;
      legGroup.add(thigh);

      // Foot & Claws
      const footGeo = new THREE.BoxGeometry(0.2, 0.08, 0.36);
      const foot = new THREE.Mesh(footGeo, darkFurMat);
      foot.position.set(0, -0.32, 0.18);
      legGroup.add(foot);

      // Claws
      [-0.05, 0, 0.05].forEach((cx) => {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.1, 6), techMat);
        claw.rotation.x = Math.PI / 2;
        claw.position.set(cx, -0.32, 0.38);
        legGroup.add(claw);
      });

      group.add(legGroup);
    });

    // 6. Front Paws Wielding the Quantum Acorn Cannon (Laser Weapon)
    // Left Paw holding base of Acorn
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.35, 0.72, 0.22);
    leftArm.rotation.set(0.65, 0.3, -0.3);

    const lPaw = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.38, 8), furMat);
    lPaw.position.y = -0.15;
    leftArm.add(lPaw);
    group.add(leftArm);

    // Right Arm aiming Quantum Acorn Blaster
    const rightArm = new THREE.Group();
    rightArm.position.set(0.42, 0.72, 0.22);
    rightArm.rotation.set(0.5, -0.2, 0.15);

    const rPaw = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.38, 8), furMat);
    rPaw.position.y = -0.15;
    rightArm.add(rPaw);

    // THE QUANTUM ACORN CANNON
    const acornGroup = new THREE.Group();
    acornGroup.position.set(0.12, -0.1, 0.45);
    acornGroup.rotation.set(-0.35, 0.2, 0);

    // Acorn textured wood cupule cap
    const cupuleGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.2, 12);
    const cupule = new THREE.Mesh(cupuleGeo, acornWoodMat);
    cupule.position.y = -0.05;
    acornGroup.add(cupule);

    // Golden acorn stem handle
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8);
    const stem = new THREE.Mesh(stemGeo, goldMat);
    stem.position.set(0, -0.2, -0.05);
    stem.rotation.x = -0.3;
    acornGroup.add(stem);

    // Glowing Pulsating Quantum Nut (Weapon Projector)
    const nutGeo = new THREE.SphereGeometry(0.26, 16, 16);
    nutGeo.scale(0.9, 1.25, 0.9);
    const nut = new THREE.Mesh(nutGeo, glowMat);
    nut.position.y = 0.24;
    acornGroup.add(nut);

    // Quantum Focus Ring
    const fRingGeo = new THREE.TorusGeometry(0.25, 0.03, 8, 20);
    fRingGeo.rotateX(Math.PI / 2);
    const fRing = new THREE.Mesh(fRingGeo, goldMat);
    fRing.position.y = 0.24;
    acornGroup.add(fRing);

    // Acorn Tip Star Crystal (Laser origin point)
    const tipCrystalGeo = new THREE.OctahedronGeometry(0.1);
    const tipCrystal = new THREE.Mesh(tipCrystalGeo, eyeSparkleMat);
    tipCrystal.position.y = 0.52;
    acornGroup.add(tipCrystal);

    // Scepter / Cannon Light
    const acornLight = new THREE.PointLight(accentColor, 2.2, 6);
    acornLight.position.y = 0.52;
    acornGroup.add(acornLight);

    rightArm.add(acornGroup);
    group.add(rightArm);

    // 7. Micro Quantum Jet Thrusters (Hip mounted)
    [-0.42, 0.42].forEach((x) => {
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.32, 8), techMat);
      jet.position.set(x, 0.45, -0.18);
      jet.rotation.x = -0.3;
      group.add(jet);

      const nozzleGlow = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), glowMat);
      nozzleGlow.rotation.x = Math.PI;
      nozzleGlow.position.set(x, 0.25, -0.24);
      group.add(nozzleGlow);
    });

    // 8. Combat Hitbox
    const hitBoxGeo = new THREE.BoxGeometry(2.0, 2.8, 2.2);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.name = "hitbox";
    group.add(hitBox);

    group.scale.set(1.35, 1.35, 1.35);
    return group;
  },
};
