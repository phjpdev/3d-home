"use client";

import { useEffect } from "react";
import type * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { GLTFLoader, MeshoptDecoder } from "three-stdlib";

import { HOUSE_GLB_URL } from "@/lib/houseGlb";
import { annotateHouseScene, type SceneAnnotationMaps } from "@/lib/houseSceneAnnotate";

export type HouseModelProps = {
  onSceneAvailable?: (root: THREE.Object3D) => void;
  onAnnotations?: (maps: SceneAnnotationMaps) => void;
};

function extendHouseLoader(loader: GLTFLoader) {
  try {
    loader.setMeshoptDecoder(
      typeof MeshoptDecoder === "function" ? MeshoptDecoder() : MeshoptDecoder,
    );
  } catch {
    /* meshopt optional for uncompressed fallbacks */
  }
}

export function HouseModel({ onSceneAvailable, onAnnotations }: HouseModelProps) {
  const { scene } = useGLTF(HOUSE_GLB_URL, false, true, extendHouseLoader);

  useEffect(() => {
    if (!scene) return;
    onSceneAvailable?.(scene);

    const annotate = () => {
      const maps = annotateHouseScene(scene);
      onAnnotations?.(maps);
    };

    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(annotate, { timeout: 150 });
      return () => cancelIdleCallback(id);
    }
    const id = requestAnimationFrame(annotate);
    return () => cancelAnimationFrame(id);
  }, [scene, onSceneAvailable, onAnnotations]);

  return <primitive object={scene} />;
}

useGLTF.preload(HOUSE_GLB_URL, false, true, extendHouseLoader);
