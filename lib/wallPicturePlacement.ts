import * as THREE from "three";

import { loadImageAspectFromSrc } from "@/lib/imageVaultTexture";

export type WallPicturePlacement = {
  imageSrc: string;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  width: number;
  height: number;
};

const STORAGE_WALL_PREFIX = "3d-home:wall-image:";

/** Reject floors, ceilings, roof pieces, trim that isn't a hangable wall. */
const NON_WALL =
  /\b(floor|ceiling|roof|soffit|fascia|eave|overhang|cornice|gutter|ridge|beam|lintel|carpet|rug|parquet|deck|stairs|steps|porch|balcony|slab|ground|walkway|path|drive|pavement|sidewalk|foundation|chimney_cap)\b/i;

/** Primary: surfaces within ~17° of vertical. Fallback: ~27°. */
const VERTICAL_Y_STRICT = 0.28;
const VERTICAL_Y_LOOSE = 0.45;

export function readStoredWallPlacement(
  siteMode: string,
): WallPicturePlacement | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_WALL_PREFIX}${siteMode}`);
    if (!raw) return null;
    if (!raw.startsWith("{")) {
      localStorage.removeItem(`${STORAGE_WALL_PREFIX}${siteMode}`);
      return null;
    }
    const parsed = JSON.parse(raw) as WallPicturePlacement;
    if (
      typeof parsed?.imageSrc === "string" &&
      Array.isArray(parsed.position) &&
      parsed.position.length === 3 &&
      Array.isArray(parsed.quaternion) &&
      parsed.quaternion.length === 4 &&
      typeof parsed.width === "number" &&
      typeof parsed.height === "number"
    ) {
      return parsed;
    }
    localStorage.removeItem(`${STORAGE_WALL_PREFIX}${siteMode}`);
    return null;
  } catch {
    return null;
  }
}

export function writeStoredWallPlacement(
  siteMode: string,
  placement: WallPicturePlacement | null,
) {
  if (typeof window === "undefined") return;
  try {
    const k = `${STORAGE_WALL_PREFIX}${siteMode}`;
    if (!placement) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(placement));
  } catch {
    /* ignore quota */
  }
}

function ancestorHasUuid(
  start: THREE.Object3D | null,
  set: ReadonlySet<string>,
): boolean {
  let o = start;
  while (o) {
    if (set.has(o.uuid)) return true;
    o = o.parent;
  }
  return false;
}

function meshNameChain(obj: THREE.Object3D): string {
  const parts: string[] = [];
  let o: THREE.Object3D | null = obj;
  for (let i = 0; i < 8 && o; i++) {
    if (o.name) parts.push(o.name);
    o = o.parent;
  }
  return parts.join(" ");
}

function worldNormal(hit: THREE.Intersection): THREE.Vector3 {
  const obj = hit.object as THREE.Mesh;
  return hit
    .face!.normal.clone()
    .transformDirection(obj.matrixWorld)
    .normalize();
}

/** Normal pointing toward the viewer (handles inverted GLB face winding). */
export function facingNormal(
  hit: THREE.Intersection,
  viewPoint: THREE.Vector3,
): THREE.Vector3 {
  const n = worldNormal(hit);
  const toViewer = viewPoint.clone().sub(hit.point);
  if (n.dot(toViewer) < 0) n.negate();
  return n.normalize();
}

/** Raycast with DoubleSide so inverted GLB wall normals still register. */
export function raycastSceneForWalls(
  raycaster: THREE.Raycaster,
  sceneRoot: THREE.Object3D,
): THREE.Intersection[] {
  const savedSides = new Map<THREE.Material, THREE.Side>();

  sceneRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!savedSides.has(m)) {
        savedSides.set(m, m.side);
        m.side = THREE.DoubleSide;
      }
    }
  });

  const hits = raycaster.intersectObject(sceneRoot, true);

  for (const [material, side] of savedSides) {
    material.side = side;
  }

  return hits;
}

/** True when the hit is a vertical hangable surface (not floor/furniture/roof). */
export function isWallSurfaceHit(
  hit: THREE.Intersection,
  occluderUuids: ReadonlySet<string>,
  furnitureUuids: ReadonlySet<string>,
  maxVerticalY: number,
): boolean {
  if (!hit.face) return false;
  const obj = hit.object as THREE.Mesh;
  if (!obj.isMesh || !obj.visible) return false;
  if (obj.userData?.wallPicture) return false;

  if (furnitureUuids.has(obj.uuid) || ancestorHasUuid(obj, furnitureUuids)) {
    return false;
  }
  if (obj.userData?.furnitureFootprint) return false;
  if (obj.userData?.walkSurface) return false;

  const normal = worldNormal(hit);
  const verticalness = Math.abs(normal.y);
  if (verticalness > maxVerticalY) return false;

  const nm = meshNameChain(obj);
  if (NON_WALL.test(nm) && verticalness > 0.12) return false;

  void occluderUuids;
  return true;
}

function pickClosestVerticalHit(
  hits: THREE.Intersection[],
  occluderUuids: ReadonlySet<string>,
  furnitureUuids: ReadonlySet<string>,
  maxVerticalY: number,
): THREE.Intersection | null {
  let best: THREE.Intersection | null = null;
  let bestDistance = Infinity;

  for (const h of hits) {
    if (!isWallSurfaceHit(h, occluderUuids, furnitureUuids, maxVerticalY)) {
      continue;
    }
    if (h.distance < bestDistance) {
      bestDistance = h.distance;
      best = h;
    }
  }

  return best;
}

/** Pick the nearest vertical wall at the clicked ray — exact click position. */
export function pickWallHit(
  hits: THREE.Intersection[],
  occluderUuids: ReadonlySet<string>,
  viewPoint?: THREE.Vector3,
  furnitureUuids: ReadonlySet<string> = new Set(),
): THREE.Intersection | null {
  void viewPoint;

  return (
    pickClosestVerticalHit(
      hits,
      occluderUuids,
      furnitureUuids,
      VERTICAL_Y_STRICT,
    ) ??
    pickClosestVerticalHit(
      hits,
      occluderUuids,
      furnitureUuids,
      VERTICAL_Y_LOOSE,
    )
  );
}

export function poseFromWallHit(
  hit: THREE.Intersection,
  textureAspect: number,
  viewPoint?: THREE.Vector3,
): Omit<WallPicturePlacement, "imageSrc"> {
  const normal = viewPoint
    ? facingNormal(hit, viewPoint)
    : worldNormal(hit);

  const WALL_OFFSET = 0.028;
  const position = hit.point.clone().addScaledVector(normal, WALL_OFFSET);

  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal,
  );

  const aspect = Math.max(0.25, textureAspect || 4 / 3);
  let width = THREE.MathUtils.clamp(0.72, 0.38, 1.2);
  let height = width / aspect;

  const maxHeight = 0.95;
  const minHeight = 0.26;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }
  if (height < minHeight) {
    height = minHeight;
    width = height * aspect;
  }

  return {
    position: [position.x, position.y, position.z],
    quaternion: [
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w,
    ],
    width,
    height,
  };
}

/** Load width/height ratio for sizing the frame at click time. */
export async function loadImageAspect(
  src: string,
  fallbacks: string[] = [],
): Promise<number> {
  return loadImageAspectFromSrc(src, fallbacks);
}
