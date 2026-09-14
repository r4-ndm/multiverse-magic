/**
 * Fit a glTF character to game height, face the flight direction, and play idle.
 * Root quaternion is owned by the player, so facing lives on the model child.
 */
const TARGET_HEIGHT = 3.3;

export function fitCharacter(THREE, model, animations = [], targetHeight = TARGET_HEIGHT) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const height = Math.max(0.001, box.max.y - box.min.y);
  model.scale.multiplyScalar(targetHeight / height);
  model.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(model);
  model.position.y -= fitted.min.y;
  // glTF faces +Z. Flight is -Z, so the chase camera sees the back.
  model.rotation.y = Math.PI;

  model.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (mat.envMapIntensity != null) mat.envMapIntensity = 0.7;
      if (mat.roughness != null && mat.roughness < 0.55) mat.roughness = 0.55;
    }
  });

  const clip =
    THREE.AnimationClip.findByName(animations, "idle") ||
    THREE.AnimationClip.findByName(animations, "Idle") ||
    THREE.AnimationClip.findByName(animations, "Idle_A") ||
    animations.find((item) => /idle/i.test(item.name));
  if (!clip) return model;

  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip);
  action.play();
  model.userData.animate = (delta) => mixer.update(delta);
  return model;
}

export function mountCharacter(THREE, gltf, targetHeight = TARGET_HEIGHT) {
  const model = fitCharacter(THREE, gltf.scene, gltf.animations || [], targetHeight);
  const holder = new THREE.Group();
  holder.add(model);
  if (model.userData.animate) holder.userData.animate = model.userData.animate;
  return holder;
}
