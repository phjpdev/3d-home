"use client";

import { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";

import { refsMatchingLibraryItem, type LibraryItem } from "@/lib/assetLibrary";
import {
  autoFitScaleForBounds,
  bottomCenterOffset,
  type ModelPlacement,
} from "@/lib/modelPlacement";
import {
  getVaultAssetBuffer,
  indexedDbAssetId,
  isIndexedDbRef,
} from "@/lib/assetVaultIdb";
import { viewerModelSrc } from "@/lib/modelUrl";

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

async function fetchArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
  return res.arrayBuffer();
}

async function loadGltfScene(url: string): Promise<THREE.Group | null> {
  const resolved = viewerModelSrc(url);
  const loader = new GLTFLoader();

  if (isIndexedDbRef(resolved)) {
    const id = indexedDbAssetId(resolved);
    const buffer = id ? await getVaultAssetBuffer(id) : null;
    if (!buffer?.byteLength) return null;
    return new Promise((resolve) => {
      loader.parse(
        buffer,
        "",
        (gltf) => resolve(gltf.scene),
        () => resolve(null),
      );
    });
  }

  if (resolved.startsWith("data:") || resolved.startsWith("blob:")) {
    const buffer = await fetchArrayBuffer(resolved);
    return new Promise((resolve) => {
      loader.parse(
        buffer,
        "",
        (gltf) => resolve(gltf.scene),
        () => resolve(null),
      );
    });
  }

  return new Promise((resolve) => {
    loader.load(resolved, (gltf) => resolve(gltf.scene), undefined, () =>
      resolve(null),
    );
  });
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
  const modelFallback = useMemo(
    () => modelBlobFallback(placement.modelRef, modelsLibrary),
    [placement.modelRef, modelsLibrary],
  );

  return (
    <PlacedModelInner
      placement={placement}
      modelFallback={modelFallback}
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

function PlacedModelInner({
  placement,
  modelFallback,
  selected,
}: {
  placement: ModelPlacement;
  modelFallback: string | null;
  selected: boolean;
}) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const contentRef = useRef<THREE.Group>(null);
  const [bounds, setBounds] = useState<THREE.Box3 | null>(null);
  const { invalidate } = useThree();
  const modelRef = placement.modelRef;

  useEffect(() => {
    let cancelled = false;
    const candidates = [modelRef, modelFallback].filter(
      (s, i, arr): s is string => Boolean(s) && arr.indexOf(s) === i,
    );

    void (async () => {
      for (const candidate of candidates) {
        try {
          const loaded = await loadGltfScene(candidate);
          if (cancelled) return;
          if (loaded) {
            setScene(loaded);
            invalidate();
            return;
          }
        } catch {
          /* try next */
        }
      }
      if (!cancelled) setScene(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [modelRef, modelFallback, invalidate]);

  useEffect(() => {
    if (!scene || !contentRef.current) return;
    const root = contentRef.current;
    while (root.children.length) root.remove(root.children[0]);

    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const fit = autoFitScaleForBounds(size);
    clone.scale.multiplyScalar(fit);
    clone.updateMatrixWorld(true);
    clone.position.copy(bottomCenterOffset(clone));
    clone.traverse((o) => {
      o.userData.placedModelPart = true;
    });

    root.add(clone);
    setBounds(new THREE.Box3().setFromObject(clone));
    invalidate();

    return () => {
      while (root.children.length) root.remove(root.children[0]);
    };
  }, [scene, invalidate]);

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

  if (!scene) return null;

  return (
    <group
      position={groupProps.position}
      quaternion={groupProps.quaternion}
      scale={groupProps.scale}
      renderOrder={11}
      userData={{ placedModel: true, placementId: placement.id }}
    >
      <group ref={contentRef} />
      {selected && bounds ? <SelectionHighlight bounds={bounds} /> : null}
    </group>
  );
}

export function PlacedModels({
  placements = [],
  modelsLibrary = [],
  selectedPlacementId = null,
}: PlacedModelsProps) {
  return (
    <Suspense fallback={null}>
      {placements.map((placement) => (
        <PlacedModelItem
          key={placement.id}
          placement={placement}
          modelsLibrary={modelsLibrary}
          selected={placement.id === selectedPlacementId}
        />
      ))}
    </Suspense>
  );
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
