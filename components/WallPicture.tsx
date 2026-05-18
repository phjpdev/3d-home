"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import {
  getVaultAssetBuffer,
  indexedDbAssetId,
  isIndexedDbRef,
} from "@/lib/assetVaultIdb";
import { computeWallPicturePose } from "@/lib/wallPicturePose";

export type WallPictureProps = {
  imageSrc?: string | null;
  scene: THREE.Object3D | null;
};

export function WallPicture({ imageSrc, scene }: WallPictureProps) {
  return (
    <Suspense fallback={null}>
      {imageSrc && scene ? (
        <WallPictureInner imageSrc={imageSrc} scene={scene} />
      ) : null}
    </Suspense>
  );
}

function WallPictureInner({
  imageSrc,
  scene,
}: {
  imageSrc: string;
  scene: THREE.Object3D;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!imageSrc) return;

    let cancelled = false;
    let createdBlobUrl: string | null = null;

    const loader = new THREE.TextureLoader();

    async function run() {
      let loadSrc = imageSrc;

      if (isIndexedDbRef(imageSrc)) {
        const id = indexedDbAssetId(imageSrc);
        const buf =
          id && !cancelled ? await getVaultAssetBuffer(id) : null;
        if (cancelled) return;
        if (!buf?.byteLength) {
          setTexture(null);
          return;
        }
        createdBlobUrl = URL.createObjectURL(new Blob([buf]));
        loadSrc = createdBlobUrl;
      }

      loader.load(
        loadSrc,
        (tex) => {
          if (cancelled) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.needsUpdate = true;
          setTexture(tex);
        },
        undefined,
        () => {
          if (!cancelled) setTexture(null);
        },
      );
    }

    void run();

    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
      setTexture((prev) => {
        if (prev) prev.dispose();
        return null;
      });
    };
  }, [imageSrc]);

  const pose = useMemo(() => computeWallPicturePose(scene), [scene]);

  if (!texture || !pose) return null;

  const { center, scale, rotationY } = pose;

  return (
    <mesh
      position={center}
      scale={scale}
      rotation={[0, rotationY, 0]}
      renderOrder={1}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <meshStandardMaterial map={texture} roughness={0.75} metalness={0.05} />
    </mesh>
  );
}
