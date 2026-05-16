"use client";

import { useLayoutEffect } from "react";
import type * as THREE from "three";
import { useGLTF } from "@react-three/drei";

export type HouseModelProps = {
  onSceneAvailable?: (root: THREE.Object3D) => void;
};

export function HouseModel({ onSceneAvailable }: HouseModelProps) {
  const { scene } = useGLTF("/house2test.glb");

  useLayoutEffect(() => {
    onSceneAvailable?.(scene);
  }, [scene, onSceneAvailable]);

  return <primitive object={scene} />;
}

useGLTF.preload("/house2test.glb");
