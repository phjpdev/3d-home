"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Clone, OrbitControls, Stage, useGLTF } from "@react-three/drei";

import { viewerModelSrc } from "@/lib/modelUrl";

function Loaded({ src }: { src: string }) {
  const resolved = viewerModelSrc(src);
  const { scene } = useGLTF(resolved);
  return (
    <Stage intensity={0.4} shadows="contact">
      <Clone object={scene} deep />
    </Stage>
  );
}

export default function GlbPreview({ url }: { url: string }) {
  if (!url) return null;

  return (
    <div className="museum-sans h-72 w-full overflow-hidden rounded-sm border border-[var(--museum-rule)] bg-[#23201b] shadow-inner">
      <Canvas camera={{ position: [1.2, 1, 2.2], fov: 42 }} dpr={[1, 2]}>
        <color attach="background" args={["#1a1816"]} />
        <ambientLight intensity={0.55} />
        <directionalLight intensity={1.1} position={[4, 7, 3]} />
        <OrbitControls enableDamping makeDefault minDistance={0.4} maxDistance={22} />
        <Suspense
          fallback={
            <mesh>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshStandardMaterial color="#b08d57" metalness={0.2} />
            </mesh>
          }
        >
          <Loaded src={url} />
        </Suspense>
      </Canvas>
      <p className="museum-sans border-t border-white/10 bg-black/35 px-2 py-1.5 text-center text-[11px] text-white/65">
        Orbit inspect — temporary lighting
      </p>
    </div>
  );
}
