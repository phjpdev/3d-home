"use client";

import { useLayoutEffect } from "react";
import type * as THREE from "three";
import { useGLTF } from "@react-three/drei";

import { annotateHouseScene, type SceneAnnotationMaps } from "@/lib/houseSceneAnnotate";

export type HouseModelProps = {
  onSceneAvailable?: (root: THREE.Object3D) => void;
  onAnnotations?: (maps: SceneAnnotationMaps) => void;
};

export function HouseModel({ onSceneAvailable, onAnnotations }: HouseModelProps) {
  const { scene } = useGLTF("/house2test.glb");

  useLayoutEffect(() => {
    if (!scene) return;
    onSceneAvailable?.(scene);
    const maps = annotateHouseScene(scene);
    onAnnotations?.(maps);
  }, [scene, onSceneAvailable, onAnnotations]);

  return <primitive object={scene} />;
}

useGLTF.preload("/house2test.glb");
