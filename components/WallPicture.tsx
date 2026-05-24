"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { loadImageTextureFromSrc } from "@/lib/imageVaultTexture";
import type { WallPicturePlacement } from "@/lib/wallPicturePlacement";

export type WallPictureProps = {
  placement?: WallPicturePlacement | null;
  imageFallbacks?: string[];
};

export function WallPicture({ placement, imageFallbacks = [] }: WallPictureProps) {
  return (
    <Suspense fallback={null}>
      {placement ? (
        <WallPictureInner
          placement={placement}
          imageFallbacks={imageFallbacks}
        />
      ) : null}
    </Suspense>
  );
}

const FRAME_RAIL = 0.058;
const INNER_LIP = 0.01;
const BEAD_RADIUS = 0.0042;
const DEPTH = 0.042;

function goldMaterial(
  color: string,
  roughness: number,
  metalness: number,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
  });
}

function FrameBar({
  position,
  size,
  material,
}: {
  position: [number, number, number];
  size: [number, number, number];
  material: THREE.MeshStandardMaterial;
}) {
  return (
    <mesh position={position} material={material}>
      <boxGeometry args={size} />
    </mesh>
  );
}

function BeadChain({
  width,
  height,
  z,
  material,
}: {
  width: number;
  height: number;
  z: number;
  material: THREE.MeshStandardMaterial;
}) {
  const spacing = BEAD_RADIUS * 2.15;
  const beads: React.ReactNode[] = [];
  let i = 0;

  for (let x = -width / 2; x <= width / 2; x += spacing) {
    beads.push(
      <mesh key={`t-${i++}`} position={[x, height / 2, z]} material={material}>
        <sphereGeometry args={[BEAD_RADIUS, 10, 10]} />
      </mesh>,
    );
  }
  for (let x = -width / 2; x <= width / 2; x += spacing) {
    beads.push(
      <mesh key={`b-${i++}`} position={[x, -height / 2, z]} material={material}>
        <sphereGeometry args={[BEAD_RADIUS, 10, 10]} />
      </mesh>,
    );
  }
  for (let y = -height / 2 + spacing; y < height / 2; y += spacing) {
    beads.push(
      <mesh key={`l-${i++}`} position={[-width / 2, y, z]} material={material}>
        <sphereGeometry args={[BEAD_RADIUS, 10, 10]} />
      </mesh>,
    );
  }
  for (let y = -height / 2 + spacing; y < height / 2; y += spacing) {
    beads.push(
      <mesh key={`r-${i++}`} position={[width / 2, y, z]} material={material}>
        <sphereGeometry args={[BEAD_RADIUS, 10, 10]} />
      </mesh>,
    );
  }

  return <group>{beads}</group>;
}

function OrnateGoldFrame({
  texture,
  width,
  height,
}: {
  texture: THREE.Texture;
  width: number;
  height: number;
}) {
  const outerW = width + 2 * FRAME_RAIL;
  const outerH = height + 2 * FRAME_RAIL;
  const innerW = width + 2 * INNER_LIP;
  const innerH = height + 2 * INNER_LIP;

  const goldBright = useMemo(() => goldMaterial("#e2c56a", 0.28, 0.88), []);
  const goldMid = useMemo(() => goldMaterial("#c9a84c", 0.34, 0.82), []);
  const goldDark = useMemo(() => goldMaterial("#8a6820", 0.42, 0.74), []);
  const goldCrown = useMemo(() => goldMaterial("#f0dc88", 0.22, 0.9), []);
  const innerLipMat = useMemo(
    () => goldMaterial("#2a1e12", 0.88, 0.08),
    [],
  );
  const backingMat = useMemo(
    () => goldMaterial("#120e0a", 0.95, 0.02),
    [],
  );

  const zPhoto = 0.016;
  const zLip = 0.01;
  const zBeads = 0.018;
  const zRecess = 0.024;
  const zMain = 0.031;
  const zCrown = 0.039;

  const barDepth = DEPTH * 0.72;
  const crownDepth = DEPTH * 0.55;
  const recessDepth = DEPTH * 0.38;

  return (
    <group>
      <mesh position={[0, 0, -DEPTH * 0.28]} material={backingMat}>
        <boxGeometry args={[outerW + 0.018, outerH + 0.018, DEPTH * 0.42]} />
      </mesh>

      <mesh position={[0, 0, zPhoto - 0.002]} renderOrder={18}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          color="#f4efe4"
          depthWrite={false}
          depthTest
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      <mesh position={[0, 0, zPhoto]} renderOrder={20}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          toneMapped
          transparent
          alphaTest={0.04}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>

      <FrameBar
        position={[0, height / 2 + INNER_LIP / 2, zLip]}
        size={[innerW, INNER_LIP, 0.006]}
        material={innerLipMat}
      />
      <FrameBar
        position={[0, -(height / 2 + INNER_LIP / 2), zLip]}
        size={[innerW, INNER_LIP, 0.006]}
        material={innerLipMat}
      />
      <FrameBar
        position={[-(width / 2 + INNER_LIP / 2), 0, zLip]}
        size={[INNER_LIP, innerH, 0.006]}
        material={innerLipMat}
      />
      <FrameBar
        position={[width / 2 + INNER_LIP / 2, 0, zLip]}
        size={[INNER_LIP, innerH, 0.006]}
        material={innerLipMat}
      />

      <BeadChain
        width={width + INNER_LIP * 0.4}
        height={height + INNER_LIP * 0.4}
        z={zBeads}
        material={goldBright}
      />

      <FrameBar
        position={[0, height / 2 + FRAME_RAIL * 0.42, zRecess]}
        size={[outerW - FRAME_RAIL * 0.5, FRAME_RAIL * 0.22, recessDepth]}
        material={goldDark}
      />
      <FrameBar
        position={[0, -(height / 2 + FRAME_RAIL * 0.42), zRecess]}
        size={[outerW - FRAME_RAIL * 0.5, FRAME_RAIL * 0.22, recessDepth]}
        material={goldDark}
      />
      <FrameBar
        position={[-(width / 2 + FRAME_RAIL * 0.42), 0, zRecess]}
        size={[FRAME_RAIL * 0.22, outerH - FRAME_RAIL * 0.5, recessDepth]}
        material={goldDark}
      />
      <FrameBar
        position={[width / 2 + FRAME_RAIL * 0.42, 0, zRecess]}
        size={[FRAME_RAIL * 0.22, outerH - FRAME_RAIL * 0.5, recessDepth]}
        material={goldDark}
      />

      <FrameBar
        position={[0, height / 2 + FRAME_RAIL * 0.62, zMain]}
        size={[outerW, FRAME_RAIL * 0.52, barDepth]}
        material={goldMid}
      />
      <FrameBar
        position={[0, -(height / 2 + FRAME_RAIL * 0.62), zMain]}
        size={[outerW, FRAME_RAIL * 0.52, barDepth]}
        material={goldMid}
      />
      <FrameBar
        position={[-(width / 2 + FRAME_RAIL * 0.62), 0, zMain]}
        size={[FRAME_RAIL * 0.52, outerH - FRAME_RAIL * 0.72, barDepth]}
        material={goldMid}
      />
      <FrameBar
        position={[width / 2 + FRAME_RAIL * 0.62, 0, zMain]}
        size={[FRAME_RAIL * 0.52, outerH - FRAME_RAIL * 0.72, barDepth]}
        material={goldMid}
      />

      <FrameBar
        position={[0, height / 2 + FRAME_RAIL - FRAME_RAIL * 0.18, zCrown]}
        size={[outerW + 0.006, FRAME_RAIL * 0.34, crownDepth]}
        material={goldCrown}
      />
      <FrameBar
        position={[0, -(height / 2 + FRAME_RAIL - FRAME_RAIL * 0.18), zCrown]}
        size={[outerW + 0.006, FRAME_RAIL * 0.34, crownDepth]}
        material={goldCrown}
      />
      <FrameBar
        position={[-(width / 2 + FRAME_RAIL - FRAME_RAIL * 0.18), 0, zCrown]}
        size={[FRAME_RAIL * 0.34, outerH + 0.006, crownDepth]}
        material={goldCrown}
      />
      <FrameBar
        position={[width / 2 + FRAME_RAIL - FRAME_RAIL * 0.18, 0, zCrown]}
        size={[FRAME_RAIL * 0.34, outerH + 0.006, crownDepth]}
        material={goldCrown}
      />

      {(
        [
          [-outerW / 2 + 0.012, outerH / 2 - 0.012],
          [outerW / 2 - 0.012, outerH / 2 - 0.012],
          [-outerW / 2 + 0.012, -outerH / 2 + 0.012],
          [outerW / 2 - 0.012, -outerH / 2 + 0.012],
        ] as [number, number][]
      ).map(([x, y], idx) => (
        <mesh
          key={`corner-${idx}`}
          position={[x, y, zCrown + 0.004]}
          material={goldBright}
        >
          <sphereGeometry args={[BEAD_RADIUS * 1.55, 10, 10]} />
        </mesh>
      ))}
    </group>
  );
}

function WallPictureInner({
  placement,
  imageFallbacks,
}: {
  placement: WallPicturePlacement;
  imageFallbacks: string[];
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const { imageSrc } = placement;
    if (!imageSrc) return;

    let cancelled = false;

    void (async () => {
      const tex = await loadImageTextureFromSrc(imageSrc, imageFallbacks);
      if (cancelled) {
        tex?.dispose();
        return;
      }
      setTexture(tex);
    })();

    return () => {
      cancelled = true;
      setTexture((prev) => {
        if (prev) prev.dispose();
        return null;
      });
    };
  }, [placement.imageSrc, imageFallbacks]);

  const groupProps = useMemo(() => {
    const q = new THREE.Quaternion(
      placement.quaternion[0],
      placement.quaternion[1],
      placement.quaternion[2],
      placement.quaternion[3],
    );
    return {
      position: new THREE.Vector3(
        placement.position[0],
        placement.position[1],
        placement.position[2],
      ),
      quaternion: q,
    };
  }, [placement]);

  if (!texture) return null;

  return (
    <group
      position={groupProps.position}
      quaternion={groupProps.quaternion}
      renderOrder={10}
      userData={{ wallPicture: true }}
    >
      <OrnateGoldFrame
        texture={texture}
        width={placement.width}
        height={placement.height}
      />
    </group>
  );
}
