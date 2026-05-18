import * as THREE from "three";

export type DoorstepPoseOptions = {
  /** Flip if interior opens toward +Z instead of -Z */
  interiorAlongNegativeZ?: boolean;
};

export type DoorstepPose = {
  eye: THREE.Vector3;
  target: THREE.Vector3;
  porchFloorY: number;
  eyeHeight: number;
  bbox: THREE.Box3;
};

export function computeDoorstepPose(
  scene: THREE.Object3D,
  options: DoorstepPoseOptions = {},
): DoorstepPose | null {
  const { interiorAlongNegativeZ = true } = options;

  scene.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(scene);
  if (box.isEmpty()) return null;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  /** Raised terrace / deck slab under the tiles (reddish deck in front of the door). */
  const porchFloor = box.min.y + size.y * 0.08;
  /** Standing eye level above the floor (~1.65 m for typical meter-scaled architecture GLBs). */
  const eyeHeight =
    size.y > 1.2
      ? 1.65
      : THREE.MathUtils.clamp(
          size.y * 0.52,
          Math.max(size.y * 0.28, 1e-3),
          Math.min(size.y * 0.82, 1.85),
        );
  const eyeY = porchFloor + eyeHeight;

  /**
   * Stand on the terrace slightly forward and to the viewer's left; still aim at the door center.
   * Forward = deeper toward -Z when interiorAlongNegativeZ (larger inset).
   * Left = -X in world space when facing into -Z.
   */
  const insetAlongDepth = size.z * 0.1;
  const lookAhead = size.z * 0.38;
  const leftOfDoorCenter = size.x * 0.072;

  let eyeZ: number;
  let targetZ: number;

  if (interiorAlongNegativeZ) {
    eyeZ = box.max.z - insetAlongDepth;
    targetZ = eyeZ - lookAhead;
  } else {
    eyeZ = box.min.z + insetAlongDepth;
    targetZ = eyeZ + lookAhead;
  }

  const eyeX = center.x - leftOfDoorCenter;
  const eye = new THREE.Vector3(eyeX, eyeY, eyeZ);
  const target = new THREE.Vector3(center.x, eyeY, targetZ);

  return {
    eye,
    target,
    porchFloorY: porchFloor,
    eyeHeight,
    bbox: box.clone(),
  };
}

/**
 * Elevated, pulled-back camera so the whole model reads on screen (orbit overview),
 * not the doorstep first-person slot used for walk mode.
 */
export function computeOrbitOverviewPose(
  scene: THREE.Object3D,
): { eye: THREE.Vector3; target: THREE.Vector3 } | null {
  scene.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(scene);
  if (box.isEmpty()) return null;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const diagonal = Math.max(size.length(), 1e-6);

  const target = center.clone();
  target.y += size.y * 0.07;

  const dist = diagonal * 1.08;
  const dir = new THREE.Vector3(0.92, 0.5, 1.05).normalize();
  const eye = target.clone().addScaledVector(dir, dist);

  return { eye, target };
}
