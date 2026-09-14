/**
 * Flat pixel card. Faces the chase camera, same size as the wizard.
 */
const HEIGHT = 3.45;

export function createPixelCard(THREE, artUrl) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 3.3, 0.6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitBox.name = "hitbox";
  hitBox.position.set(0, 1.65, 0);
  group.add(hitBox);

  const loader = new THREE.TextureLoader();
  loader.load(artUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    const img = tex.image;
    const aspect = (img.width || 1) / (img.height || 1);
    const width = HEIGHT * aspect;
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(width, HEIGHT),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.35,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    card.position.y = HEIGHT * 0.48;
    body.add(card);
  });

  let t = 0;
  const parentQuat = new THREE.Quaternion();
  const face = new THREE.Quaternion();
  group.userData.animate = (delta, camera) => {
    t += delta;
    body.position.y = Math.sin(t * 1.8) * 0.04;
    if (!camera) return;
    // Keep the picture parallel to the viewer's screen, even in a bank or from the side.
    body.parent.getWorldQuaternion(parentQuat);
    face.copy(parentQuat).invert().multiply(camera.quaternion);
    body.quaternion.copy(face);
  };
  return group;
}
