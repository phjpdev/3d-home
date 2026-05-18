"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import * as THREE from "three";
import type { ResolvedWaypoint } from "@/data/waypoints";
import type { SceneRegistry } from "@/lib/sceneRegistry";
import { computeDoorstepPose } from "@/lib/doorstepPose";
import { DoorstepCamera } from "./DoorstepCamera";
import { FloorWalkControls } from "./FloorWalkControls";
import { HouseModel } from "./HouseModel";

export type HouseViewMode = "overview" | "walk";

export type HouseViewerProps = {
  viewMode?: HouseViewMode;
  furnitureAssignments?: Record<string, string>;
  wallImageSrc?: string | null;
  currentWaypointId?: string;
  onWaypointMap?: (map: Map<string, ResolvedWaypoint>) => void;
  onRegistry?: (info: { registry: SceneRegistry }) => void;
  onFloorNavigate?: (to: string) => void;
  onWalkBack?: () => void;
};

function LoadingReporter({
  onChange,
}: {
  onChange: (s: { active: boolean; progress: number }) => void;
}) {
  const { active, progress } = useProgress();

  useEffect(() => {
    onChange({ active, progress });
  }, [active, progress, onChange]);

  return null;
}

export default function HouseViewer({
  viewMode = "overview",
  onWaypointMap,
  onRegistry,
}: HouseViewerProps = {}) {
  const [sceneRoot, setSceneRoot] = useState<THREE.Object3D | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState({
    active: true,
    progress: 0,
  });

  const doorstepPose = useMemo(
    () => (sceneRoot ? computeDoorstepPose(sceneRoot) : null),
    [sceneRoot],
  );

  const handleLoadingChange = useCallback(
    (state: { active: boolean; progress: number }) => {
      setLoadProgress(state);
    },
    [],
  );

  const handleCameraPositioned = useCallback(() => {
    setCameraReady(true);
  }, []);

  useEffect(() => {
    if (viewMode !== "walk") return;
    if (!sceneRoot || loadProgress.active) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setCameraReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [viewMode, sceneRoot, loadProgress.active]);

  useEffect(() => {
    if (!sceneRoot) return;
    onWaypointMap?.(new Map());
    onRegistry?.({ registry: { slotIds: [] } });
  }, [sceneRoot, onWaypointMap, onRegistry]);

  const showLoadingOverlay = !(
    sceneRoot !== null &&
    cameraReady &&
    !loadProgress.active
  );

  const pct = Math.round(loadProgress.progress);

  return (
    <div className="relative h-full w-full">
      {showLoadingOverlay ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-50/95 text-center backdrop-blur-sm dark:bg-zinc-950/95">
          <div
            aria-hidden
            className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-700 dark:border-t-zinc-300"
          />
          <div className="px-6">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Loading house…
            </p>
            <p className="mt-1 tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
              {pct}%
            </p>
          </div>
        </div>
      ) : null}

      <Canvas
        className="h-full w-full touch-none"
        camera={{ position: [0, 1.6, 6], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={(state) => {
          state.gl.setClearColor(0xffffff);
          state.scene.background = new THREE.Color(0xffffff);
        }}
        resize={{ scroll: false }}
      >
        <color attach="background" args={["#ffffff"]} />
        <ambientLight intensity={0.55} />
        <directionalLight intensity={1.05} position={[12, 18, 10]} />

        <LoadingReporter onChange={handleLoadingChange} />

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          makeDefault
          enabled={viewMode === "overview"}
          maxPolarAngle={Math.PI * 0.495}
          minPolarAngle={Math.PI * 0.22}
          maxDistance={120}
          minDistance={0.5}
        />

        <Suspense fallback={null}>
          <HouseModel onSceneAvailable={setSceneRoot} />
        </Suspense>

        {viewMode === "overview" ? (
          <DoorstepCamera scene={sceneRoot} onPositioned={handleCameraPositioned} />
        ) : null}

        {viewMode === "walk" && sceneRoot && doorstepPose ? (
          <FloorWalkControls sceneRoot={sceneRoot} doorstepPose={doorstepPose} />
        ) : null}
      </Canvas>
    </div>
  );
}
