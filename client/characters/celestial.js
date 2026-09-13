/**
 * Ethereal Celestial Cosmic Energy Being.
 */
export const CelestialCharacter = {
  id: "celestial",
  name: "Celestial",
  emoji: "✨",
  description: "Cosmic Being",
  defaultColor: "#ffd700",

  createMesh(THREE, accentColor = 0xffd700) {
    const group = new THREE.Group();

    // 1. Inner Core Energy Sphere
    const coreGeo = new THREE.SphereGeometry(0.7, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    const auraGeo = new THREE.SphereGeometry(0.9, 16, 16);
    const auraMat = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Mesh(auraGeo, auraMat));

    // 2. Gyroscopic Rotating Rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 12, 48), ringMat);
    group.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.04, 12, 48), ringMat);
    ring2.rotation.x = Math.PI / 2.5;
    group.add(ring2);

    // Orbiting sacred crystals
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const crystalGeo = new THREE.OctahedronGeometry(0.2);
      const crystal = new THREE.Mesh(crystalGeo, coreMat);
      crystal.position.set(Math.cos(angle) * 1.5, Math.sin(angle) * 0.6, Math.sin(angle) * 1.5);
      group.add(crystal);
    }

    const hitBox = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.name = "hitbox";
    group.add(hitBox);

    return group;
  },
};
