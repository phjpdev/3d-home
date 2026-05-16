"use client";

import { useLayoutEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

export type DoorstepCameraProps = {
  scene: THREE.Object3D | null;
  /** Flip if interior opens toward +Z instead of -Z */
  interiorAlongNegativeZ?: boolean;
  onPositioned?: () => void;
};

export function DoorstepCamera({
  scene,
  interiorAlongNegativeZ = true,
  onPositioned,
}: DoorstepCameraProps) {
  const { camera, controls } = useThree();

  useLayoutEffect(() => {
    if (!scene) return;

    scene.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(scene);
    if (box.isEmpty()) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => onPositioned?.());
      });
      return;
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const persp = camera as THREE.PerspectiveCamera;

    const porchFloor = box.min.y + size.y * 0.035;
    const eyeHeight = THREE.MathUtils.clamp(size.y * 0.052, 1.35, 1.85);
    const eyeY = porchFloor + eyeHeight;

    const insetAlongDepth = size.z * 0.018;
    const lookAhead = size.z * 0.4;

    let eyeZ: number;
    let targetZ: number;

    if (interiorAlongNegativeZ) {
      eyeZ = box.max.z - insetAlongDepth;
      targetZ = eyeZ - lookAhead;
    } else {
      eyeZ = box.min.z + insetAlongDepth;
      targetZ = eyeZ + lookAhead;
    }

    const eye = new THREE.Vector3(center.x, eyeY, eyeZ);
    const target = new THREE.Vector3(center.x, eyeY - size.y * 0.018, targetZ);

    persp.position.copy(eye);
    persp.lookAt(target);

    const orbit = controls as THREE.EventDispatcher & {
      target?: THREE.Vector3;
      update?: () => void;
    };
    if (orbit?.target) {
      orbit.target.copy(target);
      orbit.update?.();
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => onPositioned?.());
    });
  }, [scene, camera, controls, interiorAlongNegativeZ, onPositioned]);

  return null;
}
