"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import * as THREE from "three";

import type { ResolvedWaypoint } from "@/data/waypoints";
import type { SceneAnnotationMaps } from "@/lib/houseSceneAnnotate";
import { computeDoorstepPose } from "@/lib/doorstepPose";
import { EMPTY_UUID_SET } from "@/lib/emptyUuidSet";
import type { SceneRegistry } from "@/lib/sceneRegistry";
import { DoorstepCamera } from "./DoorstepCamera";
import { FloorWalkControls } from "./FloorWalkControls";
import { FurniturePlacements } from "./FurniturePlacements";
import { HouseModel } from "./HouseModel";
import { WallPicture } from "./WallPicture";

export type HouseViewMode = "overview" | "walk";

export type HouseViewerProps = {
  viewMode?: HouseViewMode;
  walkStrict?: boolean;
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
  walkStrict = false,
  furnitureAssignments = {},
  wallImageSrc = null,
  onWaypointMap,
  onRegistry,
}: HouseViewerProps = {}) {
  const [sceneRoot, setSceneRoot] = useState<THREE.Object3D | null>(null);
  const [anchors, setAnchors] = useState<Map<string, THREE.Object3D>>(
    () => new Map(),
  );

  type WalkSets = {
    walk: ReadonlySet<string>;
    occluder: ReadonlySet<string>;
    furniture: ReadonlySet<string>;
  };

  const [walkSets, setWalkSets] = useState<WalkSets | null>(null);

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

  const handleAnnotations = useCallback(
    (maps: SceneAnnotationMaps) => {
      setAnchors(new Map(maps.anchors));
      setWalkSets({
        walk: maps.walkableMeshUuids,
        occluder: maps.occluderMeshUuids,
        furniture: maps.furnitureMeshUuids,
      });
      onRegistry?.({ registry: maps.registry });
    },
    [onRegistry],
  );

  useEffect(() => {
    onWaypointMap?.(new Map());
  }, [sceneRoot, onWaypointMap]);

  const showLoadingOverlay = !(
    sceneRoot !== null &&
    cameraReady &&
    !loadProgress.active
  );

  const pct = Math.round(loadProgress.progress);

  const walkWhitelistStable = walkSets?.walk ?? EMPTY_UUID_SET;
  const occluderStable = walkSets?.occluder ?? EMPTY_UUID_SET;
  const furnitureStable = walkSets?.furniture ?? EMPTY_UUID_SET;

  return (
    <div className="relative h-full w-full bg-[var(--museum-parchment)]">
      {showLoadingOverlay ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--museum-paper)]/92 text-center backdrop-blur-sm">
          <div
            aria-hidden
            className="h-10 w-10 animate-spin rounded-full border-2 border-black/15 border-t-[var(--museum-brass)]"
          />
          <div className="px-6">
            <p className="museum-sans text-sm font-medium text-[var(--museum-ink)]">
              Unveiling floors…
            </p>
            <p className="museum-sans mt-1 tabular-nums text-xs text-[var(--museum-muted)]">
              {pct}%
            </p>
          </div>
        </div>
      ) : null}

      <Canvas
        className="museum-sans h-full w-full touch-none"
        camera={{ position: [0, 1.6, 6], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={(state) => {
          state.gl.setClearColor(0xfbf8f2);
          state.scene.background = new THREE.Color(0xfbf8f2);
        }}
        resize={{ scroll: false }}
      >
        <color attach="background" args={["#fbf8f2"]} />
        <ambientLight intensity={0.62} />
        <directionalLight intensity={1.08} position={[14, 20, 12]} />

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
          <HouseModel
            onSceneAvailable={setSceneRoot}
            onAnnotations={handleAnnotations}
          />
        </Suspense>

        <FurniturePlacements
          anchors={anchors}
          assignments={furnitureAssignments}
        />

        <WallPicture scene={sceneRoot} imageSrc={wallImageSrc} />

        {viewMode === "overview" ? (
          <DoorstepCamera
            scene={sceneRoot}
            onPositioned={handleCameraPositioned}
          />
        ) : null}

        {viewMode === "walk" && sceneRoot && doorstepPose ? (
          <FloorWalkControls
            sceneRoot={sceneRoot}
            doorstepPose={doorstepPose}
            walkStrict={walkStrict}
            walkWhitelistUuids={walkWhitelistStable}
            occluderUuids={occluderStable}
            furnitureUuids={furnitureStable}
          />
        ) : null}
      </Canvas>
    </div>
  );
}
