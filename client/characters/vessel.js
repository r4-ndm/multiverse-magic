/**
 * Sleek Scifi Interceptor Spacecraft.
 */
export const VesselCharacter = {
  id: "vessel",
  name: "Interceptor",
  emoji: "🚀",
  description: "Starfighter Ship",
  defaultColor: "#00f0ff",

  createMesh(THREE, accentColor = 0x00f0ff) {
    const shipGroup = new THREE.Group();

    // 1. Fuselage
    const bodyGeo = new THREE.ConeGeometry(0.8, 3.2, 5);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.8,
      roughness: 0.3,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    shipGroup.add(bodyMesh);

    // 2. Cockpit canopy
    const canopyGeo = new THREE.BoxGeometry(0.45, 0.35, 1.2);
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      metalness: 0.2,
    });
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.set(0, 0.35, 0.2);
    shipGroup.add(canopyMesh);

    // 3. Swept Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.8, -1.2);
    wingShape.lineTo(2.5, -1.8);
    wingShape.lineTo(0, -0.8);
    wingShape.closePath();

    const extrudeSettings = { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.rotateX(-Math.PI / 2);

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.85,
      roughness: 0.35,
    });

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0.3, 0, 0.2);
    shipGroup.add(rightWing);

    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.scale.set(-1, 1, 1);
    leftWing.position.set(-0.3, 0, 0.2);
    shipGroup.add(leftWing);

    // 4. Glowing Thruster Nozzles
    const thrusterGeo = new THREE.CylinderGeometry(0.22, 0.35, 0.6, 12);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const thrusterMesh = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterMesh.position.set(0, 0, 1.6);
    shipGroup.add(thrusterMesh);

    const engineLight = new THREE.PointLight(accentColor, 2.0, 15);
    engineLight.position.set(0, 0, 2.0);
    shipGroup.add(engineLight);

    // Hitbox for raycasting
    const hitBoxGeo = new THREE.BoxGeometry(3.5, 1.6, 4.0);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.name = "hitbox";
    shipGroup.add(hitBox);

    shipGroup.castShadow = true;
    return shipGroup;
  },
};
