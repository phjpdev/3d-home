import { DRACOLoader, GLTFLoader, MeshoptDecoder } from "three-stdlib";
import * as THREE from "three";

import {
  getVaultAssetBuffer,
  indexedDbAssetId,
  isIndexedDbRef,
} from "@/lib/assetVaultIdb";
import { viewerModelSrc } from "@/lib/modelUrl";

const DRACO_DECODER_PATH =
  "https://www.gstatic.com/draco/versioned/decoders/1.5.5/";

let dracoLoader: DRACOLoader | null = null;
const placedModelLoadingManager = new THREE.LoadingManager();

function createGltfLoader(): GLTFLoader {
  const loader = new GLTFLoader(placedModelLoadingManager);
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
  }
  loader.setDRACOLoader(dracoLoader);
  try {
    loader.setMeshoptDecoder(
      typeof MeshoptDecoder === "function" ? MeshoptDecoder() : MeshoptDecoder,
    );
  } catch {
    /* optional */
  }
  return loader;
}

async function fetchArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
  return res.arrayBuffer();
}

function parseBuffer(
  loader: GLTFLoader,
  buffer: ArrayBuffer,
): Promise<THREE.Group | null> {
  return new Promise((resolve) => {
    loader.parse(
      buffer,
      "",
      (gltf) => resolve(gltf.scene),
      () => resolve(null),
    );
  });
}

function loadRemote(
  loader: GLTFLoader,
  url: string,
): Promise<THREE.Group | null> {
  return new Promise((resolve) => {
    loader.load(url, (gltf) => resolve(gltf.scene), undefined, () =>
      resolve(null),
    );
  });
}

/** Load a GLB/GLTF scene with Draco + Meshopt (matches drei useGLTF). */
export async function loadGltfScene(url: string): Promise<THREE.Group | null> {
  const resolved = viewerModelSrc(url);
  const loader = createGltfLoader();

  if (isIndexedDbRef(resolved)) {
    const id = indexedDbAssetId(resolved);
    const buffer = id ? await getVaultAssetBuffer(id) : null;
    if (!buffer?.byteLength) return null;
    return parseBuffer(loader, buffer);
  }

  if (resolved.startsWith("data:") || resolved.startsWith("blob:")) {
    const buffer = await fetchArrayBuffer(resolved);
    return parseBuffer(loader, buffer);
  }

  return loadRemote(loader, resolved);
}

function isDirectViewerUrl(url: string): boolean {
  return (
    url.startsWith("blob:") ||
    url.startsWith("data:") ||
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/")
  );
}

/**
 * Resolve a library / vault ref to a URL drei useGLTF can load (blob or remote).
 * Prefer in-memory blob URLs from the library — same path as the preview modal.
 */
export async function resolveModelViewerUrl(
  candidates: string[],
): Promise<string | null> {
  for (const raw of candidates) {
    if (!raw) continue;

    if (isDirectViewerUrl(raw)) {
      return viewerModelSrc(raw);
    }

    const resolved = viewerModelSrc(raw);
    if (isIndexedDbRef(resolved)) {
      const id = indexedDbAssetId(resolved);
      const buffer = id ? await getVaultAssetBuffer(id) : null;
      if (buffer?.byteLength) {
        return URL.createObjectURL(
          new Blob([buffer], { type: "model/gltf-binary" }),
        );
      }
    }
  }
  return null;
}

export function revokeModelViewerUrl(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}
