import * as THREE from "three";

import { computeOrbitOverviewPose } from "@/lib/doorstepPose";

export type OrbitRoomId =
  | "hallway"
  | "living"
  | "study"
  | "corridor"
  | "garden";

type RoomPreset = {
  /** Rotate overview orbit direction around vertical axis (degrees). */
  azimuthDeg: number;
  /** Scale eye offset length (1 = default overview). */
  distMul: number;
  /** Added to orbit target in world space (fractions of bbox size). */
  targetFrac: [number, number, number];
};

const ROOM_PRESETS: Record<OrbitRoomId, RoomPreset> = {
  hallway: {
    azimuthDeg: 0,
    distMul: 1,
    targetFrac: [0, 0, 0],
  },
  living: {
    azimuthDeg: -42,
    distMul: 0.9,
    targetFrac: [-0.04, 0, -0.06],
  },
  study: {
    azimuthDeg: 78,
    distMul: 0.94,
    targetFrac: [0.05, 0, 0.04],
  },
  corridor: {
    azimuthDeg: 152,
    distMul: 1,
    targetFrac: [0, 0, 0.05],
  },
  garden: {
    azimuthDeg: -105,
    distMul: 1.12,
    targetFrac: [0, -0.02, 0.08],
  },
};

/**
 * Orbit camera eye/target for edit overview, per nominal "room" view.
 * Tuned against scene AABB; constants can be adjusted per house model.
 */
export function computeRoomOrbitPose(
  scene: THREE.Object3D,
  roomId: OrbitRoomId,
): { eye: THREE.Vector3; target: THREE.Vector3 } | null {
  const base = computeOrbitOverviewPose(scene);
  if (!base) return null;

  const p = ROOM_PRESETS[roomId];

  scene.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(scene);
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());

  const target = base.target.clone();
  target.x += size.x * p.targetFrac[0];
  target.y += size.y * p.targetFrac[1];
  target.z += size.z * p.targetFrac[2];

  const offset = base.eye.clone().sub(base.target);
  offset.applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(p.azimuthDeg),
  );
  offset.multiplyScalar(p.distMul);

  const eye = target.clone().add(offset);

  return { eye, target };
}
