import * as THREE from "three";

import type { SceneRegistry } from "@/lib/sceneRegistry";

const SLOT_PATTERN = /^slot[_-]/i;

const FLOOR_LIKE =
  /\b(floor|deck|stairs|steps?|tiles?|tile|hardwood|carpet|porch|rug|parquet|plank)\b/i;
const NEVER_FLOOR = /\b(ceiling|wall|roof)\b/i;
const SOFT_OR_TOP_SURFACE =
  /\b(bed|cushion|mattress|pillow|sofa|loveseat|couch|armchair|chair|stool|bench|tabletop|\btable\b|desk|counter|cabinet\b|dresser|shelf|mirror|pane|cloth)\b/i;

const OCC_LIKE =
  /\b(wall|partition|divider|roof|fence|pillar|pole|beam|door|window|pane|mirror|brick|drywall)\b/i;

export type SceneAnnotationMaps = {
  registry: SceneRegistry;
  anchors: Map<string, THREE.Object3D>;
  /** Meshes counted as parquet / permissible for strict locomotion */
  walkableMeshUuids: Set<string>;
  /** Meshes rays should not pass through horizontally */
  occluderMeshUuids: Set<string>;
  /** Sofas / tables / beds — never valid foot placement in strict mode */
  furnitureMeshUuids: Set<string>;
};

function labelFromSlotName(name: string): string {
  const raw = name.replace(/^slot[_-]?/i, "").replace(/_/g, " ").trim();
  if (!raw) return "Staging";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function slotIdFromName(name: string): string | null {
  const m = name.match(SLOT_PATTERN);
  if (!m) return null;
  let rest = name.slice(m[0].length).replace(/^[_\-]+/, "");
  if (!rest.trim()) rest = "staging";
  return rest.toLowerCase().replace(/\s+/g, "_").replace(/_+/g, "_");
}

/** Add invisible staging anchors inside the hull when authors omitted slot nodes. */
function ensureFallbackAnchors(scene: THREE.Object3D): void {
  scene.updateWorldMatrix(true, true);
  const existing = new Set<string>();
  scene.traverse((o) => {
    const sid = slotIdFromName(o.name);
    if (sid) existing.add(sid);
  });

  const box = new THREE.Box3().setFromObject(scene);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const floorY = box.min.y + Math.min(size.y * 0.02, 0.06);

  const specs: Array<{ id: string; x: number; z: number }> = [
    { id: "floor_near_door", x: c.x - size.x * 0.06, z: box.max.z - size.z * 0.18 },
    { id: "floor_living", x: c.x + size.x * 0.06, z: c.z },
    { id: "floor_back", x: c.x, z: box.min.z + size.z * 0.16 },
    { id: "table_surface", x: c.x, z: c.z + size.z * 0.05 },
  ];

  for (const spec of specs) {
    if (existing.has(spec.id)) continue;
    const g = new THREE.Group();
    g.name = `slot_${spec.id}`;
    g.position.set(spec.x, floorY + 0.02, spec.z);
    scene.add(g);
    existing.add(spec.id);
  }
}

function annotateMeshWalkOcclude(mesh: THREE.Mesh) {
  const n = mesh.name || mesh.parent?.name || "";
  let walk = false;
  let occ = false;

  if (
    FLOOR_LIKE.test(n) &&
    !NEVER_FLOOR.test(n) &&
    !SOFT_OR_TOP_SURFACE.test(n)
  ) {
    walk = true;
  }

  if (SOFT_OR_TOP_SURFACE.test(n)) {
    mesh.userData.furnitureFootprint = true;
  }

  if (OCC_LIKE.test(n) && !/\bfloor\b/i.test(n)) {
    occ = true;
    walk = false;
  }

  mesh.userData.walkSurface = walk;
  mesh.userData.occluder = occ;
}

/**
 * Traverse a loaded architectural GLB, tag meshes, collect slot anchors & strict-walk masks.
 */
export function annotateHouseScene(scene: THREE.Object3D): SceneAnnotationMaps {
  const ud = scene.userData as { meshyHouseMaps?: SceneAnnotationMaps };
  if (ud.meshyHouseMaps) return ud.meshyHouseMaps;

  ensureFallbackAnchors(scene);

  const anchors = new Map<string, THREE.Object3D>();
  const slots: SceneRegistry["slots"] = [];
  const walkableMeshUuids = new Set<string>();
  const occluderMeshUuids = new Set<string>();
  const furnitureMeshUuids = new Set<string>();

  scene.updateWorldMatrix(true, true);

  scene.traverse((obj) => {
    const nm = obj.name || "";
    const sid = slotIdFromName(nm);
    if (sid && !anchors.has(sid)) {
      anchors.set(sid, obj);
      slots.push({ id: sid, label: labelFromSlotName(nm) });
    }

    const meshObj = obj as THREE.Mesh & { geometry?: THREE.BufferGeometry };
    if (meshObj.isMesh && meshObj.geometry) {
      annotateMeshWalkOcclude(meshObj);
      if (meshObj.userData.walkSurface) walkableMeshUuids.add(meshObj.uuid);
      if (meshObj.userData.occluder) occluderMeshUuids.add(meshObj.uuid);
      if (meshObj.userData.furnitureFootprint) furnitureMeshUuids.add(meshObj.uuid);
    }
  });

  slots.sort((a, b) => a.id.localeCompare(b.id));

  const maps: SceneAnnotationMaps = {
    registry: { slots },
    anchors,
    walkableMeshUuids,
    occluderMeshUuids,
    furnitureMeshUuids,
  };
  ud.meshyHouseMaps = maps;
  return maps;
}
