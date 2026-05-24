import * as THREE from "three";

export type ModelPlacement = {
  id: string;
  modelRef: string;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
};

export type ModelAxis = "x" | "y" | "z";

const STORAGE_MODEL_PREFIX = "3d-home:model-placements:";

const HORIZONTAL_Y_MIN = 0.55;

const FLOOR_LIKE =
  /\b(floor|deck|stairs|steps?|tiles?|tile|hardwood|carpet|porch|rug|parquet|plank|balcony|terrace|patio|platform|concrete|cement|slab|marble|grounds?)\b/i;

const TOP_SURFACE =
  /\b(table|tabletop|\btable\b|desk|counter|cabinet\b|dresser|shelf|chair|stool|bench|sofa|loveseat|couch|armchair|bed|cushion|mattress|surface|top)\b/i;

const REJECT_SURFACE =
  /\b(wall|wallpaper|wainscot|wainscoting|paneling|panelling|molding|moulding|ceiling|roof|soffit|fascia|eave|overhang|cornice|gutter|ridge|window|pane|mirror|fence|pillar|pole|beam|lintel|chimney)\b/i;

export const MODEL_NUDGE_STEP = 0.05;
export const MODEL_ROTATE_STEP = THREE.MathUtils.degToRad(5);
export const MODEL_SCALE_FACTOR = 1.08;
export const MODEL_SCALE_MIN = 0.04;
export const MODEL_SCALE_MAX = 4.5;

const DEFAULT_PLACEMENT_SCALE: [number, number, number] = [0.55, 0.55, 0.55];

export function newModelPlacementId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `mdl_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `mdl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function isValidPlacementShape(
  parsed: unknown,
): parsed is Omit<ModelPlacement, "id"> & { id?: string } {
  if (!parsed || typeof parsed !== "object") return false;
  const p = parsed as Record<string, unknown>;
  return (
    typeof p.modelRef === "string" &&
    Array.isArray(p.position) &&
    p.position.length === 3 &&
    Array.isArray(p.quaternion) &&
    p.quaternion.length === 4 &&
    Array.isArray(p.scale) &&
    p.scale.length === 3
  );
}

function normalizePlacement(
  parsed: Omit<ModelPlacement, "id"> & { id?: string },
): ModelPlacement {
  return {
    id:
      typeof parsed.id === "string" && parsed.id.length > 0
        ? parsed.id
        : newModelPlacementId(),
    modelRef: parsed.modelRef,
    position: parsed.position,
    quaternion: parsed.quaternion,
    scale: parsed.scale,
  };
}

function isPersistableModelRef(ref: string): boolean {
  return (
    ref.startsWith("indexeddb:") ||
    ref.startsWith("data:") ||
    ref.startsWith("http://") ||
    ref.startsWith("https://")
  );
}

export function sanitizeModelPlacements(
  placements: ModelPlacement[],
): ModelPlacement[] {
  const seen = new Set<string>();
  const out: ModelPlacement[] = [];
  for (const p of placements) {
    if (!isValidPlacementShape(p)) continue;
    if (!isPersistableModelRef(p.modelRef)) continue;
    const normalized = normalizePlacement(p);
    if (seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    out.push(normalized);
  }
  return out;
}

export function readStoredModelPlacements(siteMode: string): ModelPlacement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_MODEL_PREFIX}${siteMode}`);
    if (!raw) return [];
    if (!raw.startsWith("[")) {
      localStorage.removeItem(`${STORAGE_MODEL_PREFIX}${siteMode}`);
      return [];
    }
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return sanitizeModelPlacements(
      parsed.filter(isValidPlacementShape).map((p) => normalizePlacement(p)),
    );
  } catch {
    return [];
  }
}

export function writeStoredModelPlacements(
  siteMode: string,
  placements: ModelPlacement[],
) {
  if (typeof window === "undefined") return;
  try {
    const k = `${STORAGE_MODEL_PREFIX}${siteMode}`;
    const cleaned = sanitizeModelPlacements(placements);
    if (cleaned.length === 0) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(cleaned));
  } catch {
    /* ignore quota */
  }
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

export function placementIdFromObject(obj: THREE.Object3D | null): string | null {
  let o: THREE.Object3D | null = obj;
  while (o) {
    const id = o.userData?.placementId;
    if (typeof id === "string" && id.length > 0) return id;
    o = o.parent;
  }
  return null;
}

export function raycastSceneForSurfaces(
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

export function isSurfaceHit(hit: THREE.Intersection): boolean {
  if (!hit.face) return false;
  const obj = hit.object as THREE.Mesh;
  if (!obj.isMesh || !obj.visible) return false;
  if (obj.userData?.placedModel || obj.userData?.wallPicture) return false;

  const normal = worldNormal(hit);
  const upness = normal.y;
  if (Math.abs(upness) < HORIZONTAL_Y_MIN) return false;

  const nm = meshNameChain(obj);
  if (REJECT_SURFACE.test(nm) && !FLOOR_LIKE.test(nm) && !TOP_SURFACE.test(nm)) {
    return false;
  }

  if (obj.userData?.walkSurface) return true;
  if (obj.userData?.furnitureFootprint) return true;
  if (FLOOR_LIKE.test(nm)) return true;
  if (TOP_SURFACE.test(nm)) return true;

  return upness >= 0.82;
}

export function pickSurfaceHit(
  hits: THREE.Intersection[],
): THREE.Intersection | null {
  let best: THREE.Intersection | null = null;
  let bestDistance = Infinity;

  for (const h of hits) {
    if (!isSurfaceHit(h)) continue;
    if (h.distance < bestDistance) {
      bestDistance = h.distance;
      best = h;
    }
  }

  return best;
}

export function poseFromSurfaceHit(
  hit: THREE.Intersection,
): Omit<ModelPlacement, "id" | "modelRef"> {
  const normal = worldNormal(hit);
  if (normal.y < 0) normal.negate();

  const SURFACE_OFFSET = 0.004;
  const position = hit.point.clone().addScaledVector(normal, SURFACE_OFFSET);

  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
  if (Math.abs(normal.y - 1) < 0.02) {
    quaternion.identity();
  }

  return {
    position: [position.x, position.y, position.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    scale: [...DEFAULT_PLACEMENT_SCALE],
  };
}

export function nudgeModelPlacement(
  placement: ModelPlacement,
  deltaX: number,
  deltaY: number,
  deltaZ: number,
): ModelPlacement {
  const pos = new THREE.Vector3(
    placement.position[0],
    placement.position[1],
    placement.position[2],
  );
  pos.x += deltaX * MODEL_NUDGE_STEP;
  pos.y += deltaY * MODEL_NUDGE_STEP;
  pos.z += deltaZ * MODEL_NUDGE_STEP;
  return {
    ...placement,
    position: [pos.x, pos.y, pos.z],
  };
}

export function rotateModelPlacement(
  placement: ModelPlacement,
  axis: ModelAxis,
  sign: 1 | -1,
): ModelPlacement {
  const q = new THREE.Quaternion(
    placement.quaternion[0],
    placement.quaternion[1],
    placement.quaternion[2],
    placement.quaternion[3],
  );
  const axisVec =
    axis === "x"
      ? new THREE.Vector3(1, 0, 0)
      : axis === "y"
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);
  const delta = new THREE.Quaternion().setFromAxisAngle(
    axisVec,
    sign * MODEL_ROTATE_STEP,
  );
  q.premultiply(delta);
  return {
    ...placement,
    quaternion: [q.x, q.y, q.z, q.w],
  };
}

function clampScaleComponent(v: number): number {
  return THREE.MathUtils.clamp(v, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
}

export function scaleModelPlacement(
  placement: ModelPlacement,
  axis: ModelAxis | "uniform",
  factor: number,
): ModelPlacement {
  let [sx, sy, sz] = placement.scale;
  if (axis === "uniform") {
    sx = clampScaleComponent(sx * factor);
    sy = clampScaleComponent(sy * factor);
    sz = clampScaleComponent(sz * factor);
  } else if (axis === "x") {
    sx = clampScaleComponent(sx * factor);
  } else if (axis === "y") {
    sy = clampScaleComponent(sy * factor);
  } else {
    sz = clampScaleComponent(sz * factor);
  }
  return { ...placement, scale: [sx, sy, sz] };
}

/** Bottom-center offset so model sits on placement point. */
export function bottomCenterOffset(scene: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  return new THREE.Vector3(-center.x, -box.min.y, -center.z);
}

/** Auto-fit scale multiplier for raw GLB bounds (matches FurniturePlacements). */
export function autoFitScaleForBounds(size: THREE.Vector3): number {
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim <= 0.001) return 1;
  return THREE.MathUtils.clamp(1 / maxDim, 0.06, 1.85) * 1.05;
}
