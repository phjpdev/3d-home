"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

import type { DoorstepPose } from "@/lib/doorstepPose";

function hitIsUserPlacement(obj: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (o.userData?.placedModel || o.userData?.wallPicture) return true;
    if (typeof o.userData?.placementId === "string") return true;
    o = o.parent;
  }
  return false;
}

function pointerHitsUserPlacement(
  raycaster: THREE.Raycaster,
  scene: THREE.Scene,
): boolean {
  const hits = raycaster.intersectObjects(scene.children, true);
  return hits.some((h) => hitIsUserPlacement(h.object));
}

const CURSOR_WALK = 'url("/walk-cursor.svg") 16 18, pointer';

/** Max horizontal travel per floor click (approx. meters for typical GLBs). */
const CLICK_STEP_CAP = 1.85;
/** Keyboard nudge (ArrowUp / W, ArrowDown / S). */
const KEY_STEP = 0.68;
const KEY_TRANSIT_MS = 640;

export type SurfacePolicy = {
  walkStrict: boolean;
  occluderUuids: ReadonlySet<string>;
  furnitureUuids: ReadonlySet<string>;
};

function downwardWalkableFloorY(
  sceneRoot: THREE.Object3D,
  caster: THREE.Raycaster,
  xz: THREE.Vector3,
  probeTopY: number,
  floorMinY: number,
  floorMaxY: number,
  policy: SurfacePolicy,
): number | null {
  caster.set(new THREE.Vector3(xz.x, probeTopY, xz.z), new THREE.Vector3(0, -1, 0));
  const hits = caster.intersectObject(sceneRoot, true);
  const hit = pickWalkableFloorHit(
    hits,
    xz,
    floorMinY,
    floorMaxY,
    96,
    policy,
  );
  return hit ? hit.point.y : null;
}

function placementAllowed(hit: THREE.Intersection, policy: SurfacePolicy): boolean {
  if (!policy.walkStrict) return true;
  if (!hit.object.visible) return false;
  const obj = hit.object as THREE.Mesh;
  if (!obj.isMesh) return false;
  const uuid = obj.uuid;
  if (policy.furnitureUuids.has(uuid)) return false;
  return true;
}

function ancestorHasUuid(
  start: THREE.Object3D | null,
  set: ReadonlySet<string>,
): boolean {
  let o = start as THREE.Object3D | null;
  while (o) {
    if (set.has(o.uuid)) return true;
    o = o.parent;
  }
  return false;
}

/**
 * Torso-high horizontal ray finds occluders (walls/partitions) before we reach destination.
 */
function horizontalClearTowardDest(
  sceneRoot: THREE.Object3D,
  occluders: ReadonlySet<string>,
  caster: THREE.Raycaster,
  fromEye: THREE.Vector3,
  dest: THREE.Vector3,
): boolean {
  if (occluders.size === 0) return true;
  const dx = dest.x - fromEye.x;
  const dz = dest.z - fromEye.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return true;
  const dir = new THREE.Vector3(dx / len, 0, dz / len);
  const torso = new THREE.Vector3(fromEye.x, fromEye.y - 0.42, fromEye.z);
  caster.set(torso, dir);
  const hits = caster.intersectObject(sceneRoot, true);
  const limit = len + 0.12;
  for (const h of hits) {
    if (h.distance > limit) break;
    /** Ignore skin hits at the ray origin — thin trims / posts */
    if (h.distance < 0.09) continue;
    if (!h.object.visible) continue;
    if (ancestorHasUuid(h.object, occluders)) return false;
  }
  return true;
}

function pickWalkableFloorHit(
  hits: THREE.Intersection[],
  refPos: THREE.Vector3,
  floorMinY: number,
  floorMaxY: number,
  maxHoriz: number,
  policy: SurfacePolicy,
): THREE.Intersection | null {
  for (const h of hits) {
    if (!h.face) continue;
    const obj = h.object as THREE.Mesh;
    if (!obj.visible) continue;
    if (!placementAllowed(h, policy)) continue;

    const n = h.face.normal
      .clone()
      .transformDirection(obj.matrixWorld);
    if (n.y <= 0.62) continue;

    const pt = h.point;
    if (pt.y < floorMinY || pt.y > floorMaxY) continue;

    const dx = pt.x - refPos.x;
    const dz = pt.z - refPos.z;
    const horiz = Math.hypot(dx, dz);
    if (horiz > maxHoriz) continue;

    return h;
  }
  return null;
}

function canStandAtPosition(
  sceneRoot: THREE.Object3D,
  caster: THREE.Raycaster,
  camPos: THREE.Vector3,
  dest: THREE.Vector3,
  floorMinY: number,
  floorMaxY: number,
  policy: SurfacePolicy,
): boolean {
  /** Sample walkable slabs under avatar feet vs planned step — avoids comparing eye Y to floor Y. */
  const probeTopY = camPos.y + 2.4;
  const curFloorY = downwardWalkableFloorY(
    sceneRoot,
    caster,
    new THREE.Vector3(camPos.x, 0, camPos.z),
    probeTopY,
    floorMinY,
    floorMaxY,
    policy,
  );
  const destFloorY = downwardWalkableFloorY(
    sceneRoot,
    caster,
    new THREE.Vector3(dest.x, 0, dest.z),
    probeTopY,
    floorMinY,
    floorMaxY,
    policy,
  );
  if (curFloorY === null || destFloorY === null) return false;
  return Math.abs(destFloorY - curFloorY) < 1.28;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function shortestYawDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
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
  walkStrict?: boolean;
  occluderUuids?: ReadonlySet<string>;
  furnitureUuids?: ReadonlySet<string>;
  /** When false, pointer walk is disabled (e.g. wall-picture placement). */
  locomotionEnabled?: boolean;
  /** When false, keep the current camera instead of snapping to the doorstep. */
  bindDoorstepOnMount?: boolean;
};

export function FloorWalkControls({
  sceneRoot,
  doorstepPose,
  walkStrict = false,
  occluderUuids = new Set(),
  furnitureUuids = new Set(),
  locomotionEnabled = true,
  bindDoorstepOnMount = true,
}: FloorWalkControlsProps) {
  const { camera, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const dragging = useRef(false);
  const pending = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });
  const transit = useRef<Transit | null>(null);

  const DRAG_PX = 10;

  const sizeVec = doorstepPose.bbox.getSize(new THREE.Vector3());
  const maxStep = Math.min(Math.max(sizeVec.length() * 0.28, 5), 18);

  const floorMinY = doorstepPose.bbox.min.y - 0.12;
  const floorMaxY =
    doorstepPose.bbox.min.y + Math.min(sizeVec.y * 0.42, 12);

  const policyRef = useRef<SurfacePolicy>({
    walkStrict,
    occluderUuids,
    furnitureUuids,
  });

  policyRef.current = {
    walkStrict,
    occluderUuids,
    furnitureUuids,
  };

  const tryPickHoverLocal = (): boolean => {
    const policy = policyRef.current;
    raycaster.current.setFromCamera(pointer.current, camera);
    const hits = raycaster.current.intersectObject(sceneRoot, true);

    const hit = pickWalkableFloorHit(
      hits,
      camera.position,
      floorMinY,
      floorMaxY,
      maxStep,
      policy,
    );
    return hit !== null;
  };

  const tryCommitMove = useCallback(
    (dest: THREE.Vector3, endYaw: number, durationMs: number) => {
      const policy = policyRef.current;
      const camPos = camera.position;
      if (!policy.walkStrict) {
        transit.current = {
          from: camPos.clone(),
          to: dest,
          startYaw: yaw.current,
          endYaw,
          t0: performance.now(),
          durationMs,
        };
        return;
      }
      if (
        !horizontalClearTowardDest(
          sceneRoot,
          policy.occluderUuids,
          raycaster.current,
          camPos,
          dest,
        )
      ) {
        return;
      }
      if (
        !canStandAtPosition(
          sceneRoot,
          raycaster.current,
          camPos,
          dest,
          floorMinY,
          floorMaxY,
          policy,
        )
      ) {
        return;
      }
      transit.current = {
        from: camPos.clone(),
        to: dest,
        startYaw: yaw.current,
        endYaw,
        t0: performance.now(),
        durationMs,
      };
    },
    [camera, sceneRoot, floorMinY, floorMaxY],
  );

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
    if (!bindDoorstepOnMount) return;
    camera.position.copy(doorstepPose.eye);
    camera.lookAt(doorstepPose.target);
    camera.updateMatrixWorld();

    const euler = new THREE.Euler().setFromQuaternion(
      camera.quaternion,
      "YXZ",
    );
    yaw.current = euler.y;
    pitch.current = euler.x;
  }, [camera, doorstepPose, bindDoorstepOnMount]);

  useEffect(() => {
    if (!locomotionEnabled) return;
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    yaw.current = euler.y;
    pitch.current = euler.x;
  }, [locomotionEnabled, camera]);

  useEffect(() => {
    if (!locomotionEnabled) return;

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
      setPointerFromEvent(e);
      raycaster.current.setFromCamera(pointer.current, camera);
      if (pointerHitsUserPlacement(raycaster.current, scene)) return;

      pending.current = true;
      dragging.current = false;
      last.current = { x: e.clientX, y: e.clientY };
      start.current = { x: e.clientX, y: e.clientY };
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
      if (pointerHitsUserPlacement(raycaster.current, scene)) return;

      const hits = raycaster.current.intersectObject(sceneRoot, true);
      const camPos = camera.position;
      const hit = pickWalkableFloorHit(
        hits,
        camPos,
        floorMinY,
        floorMaxY,
        maxStep,
        policyRef.current,
      );
      if (!hit?.face) return;

      const pt = hit.point;
      const dx = pt.x - camPos.x;
      const dz = pt.z - camPos.z;
      const horiz = Math.hypot(dx, dz);
      if (horiz < 1e-4) return;

      const step = Math.min(horiz, CLICK_STEP_CAP);
      const flatDir = new THREE.Vector3(dx / horiz, 0, dz / horiz);

      const dest = new THREE.Vector3(
        camPos.x + flatDir.x * step,
        camPos.y,
        camPos.z + flatDir.z * step,
      );

      const endYaw = Math.atan2(-flatDir.x, -flatDir.z);

      tryCommitMove(dest, endYaw, Math.min(1650, 780 + step * 380));
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
  }, [
    camera,
    gl.domElement,
    locomotionEnabled,
    scene,
    sceneRoot,
    floorMinY,
    floorMaxY,
    maxStep,
    tryCommitMove,
  ]);

  useEffect(() => {
    if (!locomotionEnabled) return;

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

      tryCommitMove(dest, yaw.current, KEY_TRANSIT_MS);
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [camera, locomotionEnabled, tryCommitMove]);

  useFrame(() => {
    if (!locomotionEnabled) return;

    const tr = transit.current;

    if (tr) {
      gl.domElement.style.cursor = "";
      const uRaw = (performance.now() - tr.t0) / tr.durationMs;
      const u = Math.min(1, uRaw);
      const k = easeInOutCubic(u);

      camera.position.lerpVectors(tr.from, tr.to, k);

      const dy = shortestYawDelta(tr.startYaw, tr.endYaw);
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
      return;
    }

    const hovering = !dragging.current && tryPickHoverLocal();

    gl.domElement.style.cursor = hovering ? CURSOR_WALK : "";

    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;
    camera.rotation.z = 0;
  });

  return null;
}
