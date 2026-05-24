"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

import {
  pickWallHit,
  poseFromWallHit,
  raycastSceneForWalls,
  type WallPicturePlacement,
} from "@/lib/wallPicturePlacement";
import type { HouseViewMode } from "./HouseViewer";

const CURSOR_HANG = "crosshair";

export type WallPicturePlacerProps = {
  active: boolean;
  viewMode?: HouseViewMode;
  sceneRoot: THREE.Object3D;
  occluderUuids: ReadonlySet<string>;
  furnitureUuids?: ReadonlySet<string>;
  pendingImageSrc: string;
  textureAspect: number;
  onPlaced: (placement: WallPicturePlacement) => void;
  onCancel?: () => void;
  onPlacementMissed?: () => void;
};

export function WallPicturePlacer({
  active,
  viewMode = "overview",
  sceneRoot,
  occluderUuids,
  furnitureUuids = new Set(),
  pendingImageSrc,
  textureAspect,
  onPlaced,
  onCancel,
  onPlacementMissed,
}: WallPicturePlacerProps) {
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const dragging = useRef(false);
  const pending = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });
  const yaw = useRef(0);
  const pitch = useRef(0);
  const dragThreshold = viewMode === "walk" ? 14 : 8;

  useLayoutEffect(() => {
    if (!active || viewMode !== "walk") return;
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    yaw.current = euler.y;
    pitch.current = euler.x;
  }, [active, camera, viewMode]);

  const applyWalkLook = useCallback(
    (dx: number, dy: number) => {
      yaw.current -= dx * 0.0025;
      pitch.current -= dy * 0.0025;
      pitch.current = THREE.MathUtils.clamp(pitch.current, -1.15, 1.15);
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw.current;
      camera.rotation.x = pitch.current;
      camera.rotation.z = 0;
    },
    [camera],
  );

  const commitPlacement = useCallback(
    (clientX: number, clientY: number) => {
      const el = gl.domElement;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      pointer.current.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1),
      );

      raycaster.current.setFromCamera(pointer.current, camera);
      const hits = raycastSceneForWalls(raycaster.current, sceneRoot);
      const hit = pickWallHit(
        hits,
        occluderUuids,
        camera.position,
        furnitureUuids,
      );
      if (!hit?.face) {
        onPlacementMissed?.();
        return;
      }

      const pose = poseFromWallHit(hit, textureAspect, camera.position);
      onPlaced({
        imageSrc: pendingImageSrc,
        ...pose,
      });
    },
    [
      camera,
      furnitureUuids,
      gl.domElement,
      occluderUuids,
      onPlaced,
      onPlacementMissed,
      pendingImageSrc,
      sceneRoot,
      textureAspect,
    ],
  );

  useEffect(() => {
    if (!active) {
      gl.domElement.style.cursor = "";
      return;
    }

    const el = gl.domElement;
    el.style.cursor = CURSOR_HANG;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel?.();
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (e.target !== el && !el.contains(e.target as Node)) return;
      pending.current = true;
      dragging.current = false;
      activePointerId.current = e.pointerId;
      start.current = { x: e.clientX, y: e.clientY };
      last.current = { x: e.clientX, y: e.clientY };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!pending.current || activePointerId.current !== e.pointerId) return;
      const dxTotal = e.clientX - start.current.x;
      const dyTotal = e.clientY - start.current.y;
      if (!dragging.current && Math.hypot(dxTotal, dyTotal) >= dragThreshold) {
        dragging.current = true;
      }

      if (dragging.current && viewMode === "walk") {
        const dx = e.clientX - last.current.x;
        const dy = e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY };
        applyWalkLook(dx, dy);
      }
    };

    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (activePointerId.current !== null && e.pointerId !== activePointerId.current) {
        return;
      }

      const wasPending = pending.current;
      const wasDrag = dragging.current;
      pending.current = false;
      dragging.current = false;
      activePointerId.current = null;

      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      if (!wasPending || wasDrag) return;
      commitPlacement(e.clientX, e.clientY);
    };

    window.addEventListener("keydown", onKeyDown);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      el.style.cursor = "";
    };
  }, [
    active,
    applyWalkLook,
    commitPlacement,
    gl.domElement,
    onCancel,
    viewMode,
  ]);

  return null;
}
