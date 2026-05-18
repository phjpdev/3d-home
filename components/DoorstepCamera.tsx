"use client";

import { useLayoutEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { OrbitRoomId } from "@/lib/roomOrbitPresets";
import { computeRoomOrbitPose } from "@/lib/roomOrbitPresets";

export type DoorstepCameraProps = {
  scene: THREE.Object3D | null;
  /** Flip if interior opens toward +Z instead of -Z */
  interiorAlongNegativeZ?: boolean;
  onPositioned?: () => void;
  orbitRoomId?: OrbitRoomId;
  /** Bump to re-apply the same room (re-center orbit). */
  orbitRoomRevision?: number;
};

export function DoorstepCamera({
  scene,
  interiorAlongNegativeZ = true,
  onPositioned,
  orbitRoomId = "hallway",
  orbitRoomRevision = 0,
}: DoorstepCameraProps) {
  void interiorAlongNegativeZ;
  const { camera, controls } = useThree();

  useLayoutEffect(() => {
    if (!scene) return;

    const pose = computeRoomOrbitPose(scene, orbitRoomId);
    const persp = camera as THREE.PerspectiveCamera;

    if (!pose) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => onPositioned?.());
      });
      return;
    }

    persp.position.copy(pose.eye);
    persp.lookAt(pose.target);

    const orbit = controls as THREE.EventDispatcher & {
      target?: THREE.Vector3;
      update?: () => void;
    };
    if (orbit?.target) {
      orbit.target.copy(pose.target);
      orbit.update?.();
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => onPositioned?.());
    });
  }, [scene, camera, controls, onPositioned, orbitRoomId, orbitRoomRevision]);

  return null;
}
