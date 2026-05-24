"use client";

import { Clone } from "@react-three/drei";
import { memo, useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import { refsMatchingLibraryItem, type LibraryItem } from "@/lib/assetLibrary";
import { loadGltfScene } from "@/lib/gltfSceneLoad";
import {
  autoFitScaleForBounds,
  bottomCenterOffset,
  type ModelPlacement,
} from "@/lib/modelPlacement";
import { indexedDbAssetId, isIndexedDbRef } from "@/lib/assetVaultIdb";

export type PlacedModelsProps = {
  placements?: ModelPlacement[];
  modelsLibrary?: ReadonlyArray<LibraryItem>;
  selectedPlacementId?: string | null;
};

function placementsEqual(a: ModelPlacement, b: ModelPlacement): boolean {
  return (
    a.id === b.id &&
    a.modelRef === b.modelRef &&
    a.position[0] === b.position[0] &&
    a.position[1] === b.position[1] &&
    a.position[2] === b.position[2] &&
    a.quaternion[0] === b.quaternion[0] &&
    a.quaternion[1] === b.quaternion[1] &&
    a.quaternion[2] === b.quaternion[2] &&
    a.quaternion[3] === b.quaternion[3] &&
    a.scale[0] === b.scale[0] &&
    a.scale[1] === b.scale[1] &&
    a.scale[2] === b.scale[2]
  );
}

function modelBlobFallback(
  ref: string,
  models: ReadonlyArray<LibraryItem>,
): string | null {
  if (!isIndexedDbRef(ref)) return null;
  const id = indexedDbAssetId(ref);
  if (!id) return null;
  const item = models.find((m) => m.id === id);
  if (!item?.src) return null;
  if (
    item.src.startsWith("blob:") ||
    item.src.startsWith("data:") ||
    item.src.startsWith("http")
  ) {
    return item.src;
  }
  return null;
}

export function libraryBlobFallbackForModelRef(
  ref: string,
  models: ReadonlyArray<LibraryItem>,
): string | null {
  const item = models.find((m) => refsMatchingLibraryItem(m).includes(ref));
  if (!item?.src) return null;
  if (
    item.src.startsWith("blob:") ||
    item.src.startsWith("data:") ||
    item.src.startsWith("http")
  ) {
    return item.src;
  }
  return null;
}

/** Blob / library URLs first — matches GlbPreview. Vault ref as fallback. */
function resolveModelLoadCandidates(
  modelRef: string,
  modelsLibrary: ReadonlyArray<LibraryItem>,
): string[] {
  return [
    libraryBlobFallbackForModelRef(modelRef, modelsLibrary),
    modelBlobFallback(modelRef, modelsLibrary),
    modelRef,
  ].filter((s, i, arr): s is string => Boolean(s) && arr.indexOf(s) === i);
}

const PlacedModelItem = memo(function PlacedModelItem({
  placement,
  modelsLibrary,
  selected,
}: {
  placement: ModelPlacement;
  modelsLibrary: ReadonlyArray<LibraryItem>;
  selected: boolean;
}) {
  const loadCandidates = useMemo(
    () => resolveModelLoadCandidates(placement.modelRef, modelsLibrary),
    [placement.modelRef, modelsLibrary],
  );

  return (
    <PlacedModelInner
      placement={placement}
      loadCandidates={loadCandidates}
      selected={selected}
    />
  );
}, (prev, next) => {
  if (prev.selected !== next.selected) return false;
  if (prev.modelsLibrary !== next.modelsLibrary) return false;
  return placementsEqual(prev.placement, next.placement);
});

function SelectionHighlight({ bounds }: { bounds: THREE.Box3 }) {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  return (
    <mesh position={center} renderOrder={12}>
      <boxGeometry args={[size.x * 1.06, size.y * 1.06, size.z * 1.06]} />
      <meshBasicMaterial
        color="#c9a84c"
        wireframe
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </mesh>
  );
}

function prepareSceneForDisplay(scene: THREE.Object3D) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    mesh.userData.placedModelPart = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.side = THREE.DoubleSide;
      mat.needsUpdate = true;
    }
  });
}

function computePlacedLayout(source: THREE.Object3D) {
  const probe = source.clone(true);
  const box = new THREE.Box3().setFromObject(probe);
  const size = box.getSize(new THREE.Vector3());
  const fit = autoFitScaleForBounds(size);
  probe.scale.multiplyScalar(fit);
  probe.updateMatrixWorld(true);
  const offset = bottomCenterOffset(probe);
  probe.position.copy(offset);
  probe.updateMatrixWorld(true);
  return {
    fit,
    offset,
    bounds: new THREE.Box3().setFromObject(probe),
  };
}

/**
 * Loads placed GLBs outside drei's useGLTF so progress updates do not
 * synchronously notify LoadingReporter during render (React 19 / R3F).
 */
function PlacedModelInner({
  placement,
  loadCandidates,
  selected,
}: {
  placement: ModelPlacement;
  loadCandidates: string[];
  selected: boolean;
}) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const { invalidate } = useThree();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      for (const candidate of loadCandidates) {
        try {
          const loaded = await loadGltfScene(candidate);
          if (cancelled) return;
          if (loaded) {
            prepareSceneForDisplay(loaded);
            setScene(loaded);
            invalidate();
            return;
          }
        } catch {
          /* try next candidate */
        }
      }
      if (!cancelled) setScene(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadCandidates, invalidate]);

  const layout = useMemo(
    () => (scene ? computePlacedLayout(scene) : null),
    [scene],
  );

  const groupProps = useMemo(() => {
    const q = new THREE.Quaternion(
      placement.quaternion[0],
      placement.quaternion[1],
      placement.quaternion[2],
      placement.quaternion[3],
    );
    return {
      position: new THREE.Vector3(
        placement.position[0],
        placement.position[1],
        placement.position[2],
      ),
      quaternion: q,
      scale: new THREE.Vector3(
        placement.scale[0],
        placement.scale[1],
        placement.scale[2],
      ),
    };
  }, [
    placement.position[0],
    placement.position[1],
    placement.position[2],
    placement.quaternion[0],
    placement.quaternion[1],
    placement.quaternion[2],
    placement.quaternion[3],
    placement.scale[0],
    placement.scale[1],
    placement.scale[2],
  ]);

  if (!scene || !layout) return null;

  return (
    <group
      position={groupProps.position}
      quaternion={groupProps.quaternion}
      scale={groupProps.scale}
      renderOrder={11}
      userData={{ placedModel: true, placementId: placement.id }}
    >
      <group position={layout.offset}>
        <group scale={layout.fit}>
          <Clone object={scene} deep />
        </group>
        {selected ? <SelectionHighlight bounds={layout.bounds} /> : null}
      </group>
    </group>
  );
}

export function PlacedModels({
  placements = [],
  modelsLibrary = [],
  selectedPlacementId = null,
}: PlacedModelsProps) {
  return (
    <>
      {placements.map((placement) => (
        <PlacedModelItem
          key={placement.id}
          placement={placement}
          modelsLibrary={modelsLibrary}
          selected={placement.id === selectedPlacementId}
        />
      ))}
    </>
  );
}
