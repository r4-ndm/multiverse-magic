/**
 * Cyber Mecha / Android Humanoid.
 */
export const AndroidCharacter = {
  id: "android",
  name: "Android",
  emoji: "🤖",
  description: "Cyber Mecha",
  defaultColor: "#9d00ff",

  createMesh(THREE, accentColor = 0x9d00ff) {
    const group = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e29,
      roughness: 0.25,
      metalness: 0.9,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: accentColor });

    // Angular Torso
    const torsoGeo = new THREE.BoxGeometry(0.9, 1.3, 0.6);
    const torso = new THREE.Mesh(torsoGeo, metalMat);
    torso.position.y = 0.65;
    group.add(torso);

    // Glowing Arc Reactor Core
    const coreGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
    coreGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(coreGeo, glowMat);
    core.position.set(0, 0.8, 0.32);
    group.add(core);

    // Android Head with cyclops visor
    const headGeo = new THREE.BoxGeometry(0.5, 0.55, 0.55);
    const head = new THREE.Mesh(headGeo, metalMat);
    head.position.y = 1.6;
    group.add(head);

    const eyeGeo = new THREE.BoxGeometry(0.38, 0.08, 0.1);
    const eye = new THREE.Mesh(eyeGeo, glowMat);
    eye.position.set(0, 1.62, 0.28);
    group.add(eye);

    // Shoulder Pauldrons & Arms
    [-0.75, 0.75].forEach((x) => {
      const pauldronGeo = new THREE.ConeGeometry(0.32, 0.5, 4);
      const pauldron = new THREE.Mesh(pauldronGeo, metalMat);
      pauldron.position.set(x, 1.15, 0);
      pauldron.rotation.z = x > 0 ? -Math.PI / 2.5 : Math.PI / 2.5;
      group.add(pauldron);

      const armGeo = new THREE.BoxGeometry(0.24, 0.9, 0.24);
      const arm = new THREE.Mesh(armGeo, metalMat);
      arm.position.set(x, 0.5, 0);
      group.add(arm);
    });

    // Legs
    [-0.32, 0.32].forEach((x) => {
      const legGeo = new THREE.BoxGeometry(0.28, 1.1, 0.28);
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(x, -0.45, 0);
      group.add(leg);
    });

    // Rear Jet Thruster
    const thrusterGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.5, 8);
    thrusterGeo.rotateX(Math.PI / 2);
    const thruster = new THREE.Mesh(thrusterGeo, glowMat);
    thruster.position.set(0, 0.6, -0.45);
    group.add(thruster);

    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 1.8), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.name = "hitbox";
    group.add(hitBox);

    group.scale.set(1.4, 1.4, 1.4);
    return group;
  },
};
