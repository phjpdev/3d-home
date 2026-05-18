"use client";

/* eslint-disable react-hooks/immutability -- imperative Three.js camera / canvas DOM updates inside R3F */

import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { DoorstepPose } from "@/lib/doorstepPose";

const CURSOR_WALK = 'url("/walk-cursor.svg") 16 18, pointer';

/** Max horizontal travel per floor click (approx. meters for typical GLBs). */
const CLICK_STEP_CAP = 1.85;
/** Keyboard nudge (ArrowUp / W, ArrowDown / S). */
const KEY_STEP = 0.68;
const KEY_TRANSIT_MS = 640;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

type Transit = {
  from: THREE.Vector3;
  to: THREE.Vector3;
  startYaw: number;
  endYaw: number;
  t0: number;
  durationMs: number;
};

export type FloorWalkControlsProps = {
  sceneRoot: THREE.Object3D;
  doorstepPose: DoorstepPose;
};

export function FloorWalkControls({
  sceneRoot,
  doorstepPose,
}: FloorWalkControlsProps) {
  const { camera, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const hoverPoint = useRef<THREE.Vector3 | null>(null);
  const hoverNormal = useRef(new THREE.Vector3(0, 1, 0));
  const yaw = useRef(0);
  const pitch = useRef(0);
  const dragging = useRef(false);
  const pending = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });
  const transit = useRef<Transit | null>(null);
  const marker = useRef<THREE.Group | null>(null);

  const DRAG_PX = 10;

  const sizeVec = doorstepPose.bbox.getSize(new THREE.Vector3());
  const diagonal = sizeVec.length();
  const maxStep = Math.min(Math.max(diagonal * 0.22, 4), 14);
  const floorMinY = doorstepPose.porchFloorY - 0.35;
  const floorMaxY = doorstepPose.porchFloorY + Math.max(sizeVec.y * 0.12, 0.45);

  const tryPickHover = (): boolean => {
    raycaster.current.setFromCamera(pointer.current, camera);
    const hits = raycaster.current.intersectObject(sceneRoot, true);
    const camPos = camera.position;

    for (const h of hits) {
      if (!h.face) continue;
      const obj = h.object as THREE.Mesh;
      if (!obj.visible) continue;

      const n = h.face.normal
        .clone()
        .transformDirection(obj.matrixWorld);
      if (n.y < 0.82) continue;

      const pt = h.point;
      if (pt.y < floorMinY || pt.y > floorMaxY) continue;

      const dx = pt.x - camPos.x;
      const dz = pt.z - camPos.z;
      const horiz = Math.hypot(dx, dz);
      if (horiz > maxStep) continue;

      hoverPoint.current = pt.clone();
      hoverNormal.current.copy(n).normalize();
      return true;
    }

    hoverPoint.current = null;
    return false;
  };

  useLayoutEffect(() => {
    const p = camera as THREE.PerspectiveCamera;
    const prevFov = p.fov;
    p.fov = 72;
    p.updateProjectionMatrix();
    return () => {
      p.fov = prevFov;
      p.updateProjectionMatrix();
    };
  }, [camera]);

  useLayoutEffect(() => {
    const group = new THREE.Group();
    const ovalGeom = new THREE.CircleGeometry(0.45, 48);
    const ovalMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const oval = new THREE.Mesh(ovalGeom, ovalMat);
    oval.rotation.x = -Math.PI / 2;
    oval.scale.set(1.35, 1, 0.75);

    const chevShape = new THREE.Shape();
    chevShape.moveTo(0, 0.35);
    chevShape.lineTo(0.45, -0.35);
    chevShape.lineTo(-0.45, -0.35);
    chevShape.closePath();
    const chevGeom = new THREE.ShapeGeometry(chevShape);
    const chevMat = new THREE.MeshBasicMaterial({
      color: 0x27272a,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const chev = new THREE.Mesh(chevGeom, chevMat);
    chev.rotation.x = -Math.PI / 2;
    chev.position.y = 0.02;

    group.add(oval);
    group.add(chev);
    group.visible = false;
    marker.current = group;
    scene.add(group);

    return () => {
      scene.remove(group);
      ovalGeom.dispose();
      ovalMat.dispose();
      chevGeom.dispose();
      chevMat.dispose();
      marker.current = null;
    };
  }, [scene]);

  useLayoutEffect(() => {
    camera.position.copy(doorstepPose.eye);
    camera.lookAt(doorstepPose.target);
    camera.updateMatrixWorld();

    const euler = new THREE.Euler().setFromQuaternion(
      camera.quaternion,
      "YXZ",
    );
    yaw.current = euler.y;
    pitch.current = euler.x;
  }, [camera, doorstepPose]);

  useEffect(() => {
    const el = gl.domElement;

    const setPointerFromEvent = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -(((e.clientY - rect.top) / rect.height) * 2 - 1),
      );
    };

    const onMove = (e: PointerEvent) => {
      setPointerFromEvent(e);
      if (!pending.current || transit.current) return;
      const dxTotal = e.clientX - start.current.x;
      const dyTotal = e.clientY - start.current.y;
      if (!dragging.current && Math.hypot(dxTotal, dyTotal) >= DRAG_PX) {
        dragging.current = true;
      }
      if (!dragging.current) return;

      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };

      yaw.current -= dx * 0.0025;
      pitch.current -= dy * 0.0025;
      pitch.current = THREE.MathUtils.clamp(pitch.current, -1.15, 1.15);
    };

    const onDown = (e: PointerEvent) => {
      if (transit.current) return;
      pending.current = true;
      dragging.current = false;
      last.current = { x: e.clientX, y: e.clientY };
      start.current = { x: e.clientX, y: e.clientY };
      setPointerFromEvent(e);
      el.setPointerCapture(e.pointerId);
    };

    const onUp = (e: PointerEvent) => {
      const wasPending = pending.current;
      const wasDrag = dragging.current;
      pending.current = false;
      dragging.current = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      if (!wasPending || transit.current) return;

      setPointerFromEvent(e);

      if (wasDrag) return;

      raycaster.current.setFromCamera(pointer.current, camera);
      const hits = raycaster.current.intersectObject(sceneRoot, true);
      const camPos = camera.position;

      for (const h of hits) {
        if (!h.face) continue;
        const obj = h.object as THREE.Mesh;
        if (!obj.visible) continue;

        const n = h.face.normal
          .clone()
          .transformDirection(obj.matrixWorld);
        if (n.y < 0.82) continue;

        const pt = h.point;
        if (pt.y < floorMinY || pt.y > floorMaxY) continue;

        const dx = pt.x - camPos.x;
        const dz = pt.z - camPos.z;
        const horiz = Math.hypot(dx, dz);
        if (horiz < 1e-4 || horiz > maxStep) continue;

        const step = Math.min(horiz, CLICK_STEP_CAP);
        const flatDir = new THREE.Vector3(dx / horiz, 0, dz / horiz);

        const dest = new THREE.Vector3(
          camPos.x + flatDir.x * step,
          camPos.y,
          camPos.z + flatDir.z * step,
        );

        const orient = new THREE.Object3D();
        orient.position.copy(camPos);
        orient.lookAt(camPos.x + flatDir.x, camPos.y, camPos.z + flatDir.z);
        const eu = new THREE.Euler().setFromQuaternion(
          orient.quaternion,
          "YXZ",
        );
        const endYaw = eu.y;

        transit.current = {
          from: camPos.clone(),
          to: dest,
          startYaw: yaw.current,
          endYaw,
          t0: performance.now(),
          durationMs: Math.min(1650, 780 + step * 380),
        };
        break;
      }
    };

    const onCancel = (e: PointerEvent) => {
      pending.current = false;
      dragging.current = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.style.cursor = "";
    };
  }, [camera, gl.domElement, sceneRoot, floorMinY, floorMaxY, maxStep]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (transit.current) return;

      const tgt = e.target as Node | null;
      if (tgt instanceof Element) {
        const tag = tgt.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")
          return;
        if ((tgt as HTMLElement).isContentEditable) return;
      }

      let forward: boolean | null = null;
      if (e.code === "ArrowUp" || e.code === "KeyW") forward = true;
      else if (e.code === "ArrowDown" || e.code === "KeyS") forward = false;
      else return;

      e.preventDefault();

      const camPos = camera.position;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0;
      if (dir.lengthSq() < 1e-10) dir.set(0, 0, -1);
      dir.normalize();
      if (forward === false) dir.multiplyScalar(-1);

      const dest = camPos.clone().addScaledVector(dir, KEY_STEP);
      dest.y = camPos.y;

      transit.current = {
        from: camPos.clone(),
        to: dest,
        startYaw: yaw.current,
        endYaw: yaw.current,
        t0: performance.now(),
        durationMs: KEY_TRANSIT_MS,
      };
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [camera]);

  useFrame(() => {
    const g = marker.current;
    const tr = transit.current;

    if (tr) {
      gl.domElement.style.cursor = "";
      const uRaw = (performance.now() - tr.t0) / tr.durationMs;
      const u = Math.min(1, uRaw);
      const k = easeInOutCubic(u);

      camera.position.lerpVectors(tr.from, tr.to, k);

      let dy = tr.endYaw - tr.startYaw;
      dy = ((dy + Math.PI) % (Math.PI * 2)) - Math.PI;
      yaw.current = tr.startYaw + dy * k;

      pitch.current = THREE.MathUtils.lerp(pitch.current, 0, 0.14);

      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw.current;
      camera.rotation.x = pitch.current;
      camera.rotation.z = 0;

      if (u >= 1) {
        transit.current = null;
        camera.position.copy(tr.to);
        yaw.current = tr.endYaw;
        pitch.current = 0;
      }
      if (g) g.visible = false;
      return;
    }

    const hovering = !dragging.current && tryPickHover();

    gl.domElement.style.cursor = hovering ? CURSOR_WALK : "";

    if (g && hoverPoint.current) {
      const pt = hoverPoint.current;
      const n = hoverNormal.current;
      g.visible = true;
      g.position.copy(pt).addScaledVector(n, 0.025);
      g.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        n.clone().normalize(),
      );
    } else if (g) {
      g.visible = false;
    }

    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;
    camera.rotation.z = 0;
  });

  return null;
}
