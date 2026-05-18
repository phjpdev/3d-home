"use client";

import { Suspense, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { viewerModelSrc } from "@/lib/modelUrl";

function OnePlacement({
  anchor,
  url,
}: {
  anchor?: THREE.Object3D;
  url: string;
}) {
  const { scene } = useGLTF(url);
  const wrapper = useRef<THREE.Group>(null);
  const { invalidate } = useThree();

  useEffect(() => {
    if (!anchor || !scene || !wrapper.current) return;
    const w = wrapper.current;
    while (w.children.length) w.remove(w.children[0]);
    w.scale.setScalar(1);
    w.position.setScalar(0);
    w.rotation.set(0, 0, 0);
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0.001) {
      const targetScale = THREE.MathUtils.clamp(1 / maxDim, 0.06, 1.85);
      clone.scale.multiplyScalar(targetScale * 1.05);
    }
    clone.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(clone);
    clone.position.set(
      -(b2.min.x + b2.max.x) / 2,
      -b2.min.y,
      -(b2.min.z + b2.max.z) / 2,
    );

    anchor.add(w);
    w.add(clone);
    invalidate();
    return () => {
      while (w.children.length) w.remove(w.children[0]);
      anchor.remove(w);
      invalidate();
    };
  }, [anchor, invalidate, scene]);

  return <group ref={wrapper} />;
}

export function FurniturePlacements({
  anchors,
  assignments,
}: {
  anchors: Map<string, THREE.Object3D>;
  assignments: Record<string, string>;
}) {
  const entries = Object.entries(assignments).filter(
    ([id, url]) => id && url && anchors.has(id),
  );

  return (
    <>
      {entries.map(([slotId, rawUrl]) => (
        <Suspense key={`${slotId}:${rawUrl.slice(0, 120)}`} fallback={null}>
          <OnePlacement
            anchor={anchors.get(slotId)}
            url={viewerModelSrc(rawUrl)}
          />
        </Suspense>
      ))}
    </>
  );
}
