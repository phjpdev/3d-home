import * as THREE from "three";

import {
  getVaultAssetBuffer,
  indexedDbAssetId,
  isIndexedDbRef,
} from "@/lib/assetVaultIdb";

export function imageMimeFromBuffer(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  if (u8.length >= 4 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e) {
    return "image/png";
  }
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    u8.length >= 12 &&
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46
  ) {
    return "image/webp";
  }
  return "image/png";
}

async function resolveImageBytes(src: string): Promise<ArrayBuffer | null> {
  if (isIndexedDbRef(src)) {
    const id = indexedDbAssetId(src);
    return id ? await getVaultAssetBuffer(id) : null;
  }
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",");
    if (comma < 0) return null;
    const meta = src.slice(0, comma);
    const payload = src.slice(comma + 1);
    if (meta.includes(";base64")) {
      const bin = atob(payload);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    }
    const out = new TextEncoder().encode(decodeURIComponent(payload));
    return out.buffer;
  }
  if (src.startsWith("blob:") || src.startsWith("http")) {
    const res = await fetch(src);
    if (!res.ok) return null;
    return res.arrayBuffer();
  }
  return null;
}

function configureLoadedTexture(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

async function textureFromBlob(blob: Blob): Promise<THREE.Texture | null> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image_decode_failed"));
      el.src = url;
    });
    const tex = configureLoadedTexture(new THREE.Texture(img));
    tex.flipY = true;
    return tex;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function textureFromBytes(buf: ArrayBuffer): Promise<THREE.Texture | null> {
  const mime = imageMimeFromBuffer(buf);
  return textureFromBlob(new Blob([buf], { type: mime }));
}

/** Decode image bytes into a GPU texture. Tries primary src then optional fallbacks. */
export async function loadImageTextureFromSrc(
  src: string,
  fallbacks: string[] = [],
): Promise<THREE.Texture | null> {
  const candidates = [src, ...fallbacks].filter(
    (s, i, arr) => s.length > 0 && arr.indexOf(s) === i,
  );

  for (const candidate of candidates) {
    try {
      const buf = await resolveImageBytes(candidate);
      if (buf?.byteLength) {
        const tex = await textureFromBytes(buf);
        if (tex) return tex;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function loadImageAspectFromSrc(
  src: string,
  fallbacks: string[] = [],
): Promise<number> {
  const candidates = [src, ...fallbacks].filter(
    (s, i, arr) => s.length > 0 && arr.indexOf(s) === i,
  );

  for (const candidate of candidates) {
    try {
      const buf = await resolveImageBytes(candidate);
      if (!buf?.byteLength) continue;
      const mime = imageMimeFromBuffer(buf);
      const url = URL.createObjectURL(new Blob([buf], { type: mime }));
      try {
        const ar = await new Promise<number>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            resolve(
              img.naturalWidth > 0 && img.naturalHeight > 0
                ? img.naturalWidth / img.naturalHeight
                : 4 / 3,
            );
          };
          img.onerror = () => reject(new Error("aspect_failed"));
          img.src = url;
        });
        return ar;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      /* try next */
    }
  }
  return 4 / 3;
}

/** Resolve hydrated blob:/data: URLs for a vault-backed library item id. */
export function libraryBlobFallbackForRef(
  ref: string,
  images: ReadonlyArray<{ id: string; src: string }>,
): string | null {
  if (!isIndexedDbRef(ref)) return null;
  const id = indexedDbAssetId(ref);
  if (!id) return null;
  const item = images.find((img) => img.id === id);
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
