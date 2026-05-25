"use client";

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

import { placementIdFromObject } from "@/lib/wallPicturePlacement";
import { WALK_LOOK_SENSITIVITY } from "@/lib/walkCameraTuning";
import type { HouseViewMode } from "./HouseViewer";

const CURSOR_SELECT = "pointer";

export type WallPictureSelectorProps = {
  active: boolean;
  viewMode?: HouseViewMode;
  onSelect: (placementId: string | null) => void;
};

export function WallPictureSelector({
  active,
  viewMode = "overview",
  onSelect,
}: WallPictureSelectorProps) {
  const { camera, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const dragging = useRef(false);
  const pending = useRef(false);
  const selectingPhoto = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });
  const yaw = useRef(0);
  const pitch = useRef(0);
  const dragThreshold = viewMode === "walk" ? 14 : 8;

  useEffect(() => {
    if (!active || viewMode !== "walk") return;
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    yaw.current = euler.y;
    pitch.current = euler.x;
  }, [active, camera, viewMode]);

  const applyWalkLook = useCallback(
    (dx: number, dy: number) => {
      yaw.current -= dx * WALK_LOOK_SENSITIVITY;
      pitch.current -= dy * WALK_LOOK_SENSITIVITY;
      pitch.current = THREE.MathUtils.clamp(pitch.current, -1.15, 1.15);
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw.current;
      camera.rotation.x = pitch.current;
      camera.rotation.z = 0;
    },
    [camera],
  );

  const pickPlacement = useCallback(
    (clientX: number, clientY: number): string | null => {
      const el = gl.domElement;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      pointer.current.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1),
      );

      raycaster.current.setFromCamera(pointer.current, camera);
      const hits = raycaster.current.intersectObjects(scene.children, true);
      for (const hit of hits) {
        const id = placementIdFromObject(hit.object);
        if (id) return id;
      }
      return null;
    },
    [camera, gl.domElement, scene.children],
  );

  useEffect(() => {
    if (!active) {
      gl.domElement.style.cursor = "";
      return;
    }

    const el = gl.domElement;
    el.style.cursor = CURSOR_SELECT;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (e.target !== el && !el.contains(e.target as Node)) return;

      const hitId = pickPlacement(e.clientX, e.clientY);
      if (!hitId) {
        if (viewMode === "overview") onSelect(null);
        return;
      }

      e.stopPropagation();
      selectingPhoto.current = true;
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
      const wasSelecting = selectingPhoto.current;
      pending.current = false;
      dragging.current = false;
      selectingPhoto.current = false;
      activePointerId.current = null;

      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      if (!wasPending || !wasSelecting) return;
      if (wasDrag) return;
      const hitId = pickPlacement(e.clientX, e.clientY);
      if (hitId) onSelect(hitId);
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      el.style.cursor = "";
    };
  }, [
    active,
    applyWalkLook,
    dragThreshold,
    gl.domElement,
    pickPlacement,
    onSelect,
    viewMode,
  ]);

  return null;
}
