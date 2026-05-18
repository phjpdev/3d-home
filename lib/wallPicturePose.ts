import * as THREE from "three";

/**
 * Picks a plausible interior-facing wall pose for an unframed print.
 * Uses the scene AABB relative to doorway convention (living depth toward −Z).
 */
export function computeWallPicturePose(
  scene: THREE.Object3D,
): {
  center: THREE.Vector3;
  scale: THREE.Vector3;
  rotationY: number;
} | null {
  scene.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(scene);
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  const cx = (box.min.x + box.max.x) / 2;
  /** Far wall (~ room depth) receives the picture; inset slightly inward +Z viewer side */
  const zFace = box.min.z + Math.max(size.z * 0.02, 0.035);
  const y = box.min.y + THREE.MathUtils.clamp(size.y * 0.45, 0.9, 2.05);
  const center = new THREE.Vector3(cx, y, zFace);
  const w = THREE.MathUtils.clamp(size.x * 0.16, 0.35, 1.25);
  const h = THREE.MathUtils.clamp(size.y * 0.11, 0.22, 0.92);
  return {
    center,
    scale: new THREE.Vector3(w, h, 1),
    rotationY: 0,
  };
}
