"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";

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
    const loader = new THREE.TextureLoader();
    let revoked = false;
    loader.load(
      imageSrc,
      (tex) => {
        if (revoked) {
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
        setTexture(null);
      },
    );
    return () => {
      revoked = true;
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
