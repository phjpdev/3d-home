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

/** Muted grey B&W — visible like built-in GLB wall photos. */
function gradeWallPhotoGrey(data: ImageData): void {
  const { width, height, data: px } = data;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy);

  const blackPoint = 0.04;
  const whitePoint = 0.9;
  const gamma = 1.02;
  const lift = 0.04;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (px[i + 3] < 8) continue;

      const r0 = px[i] / 255;
      const g0 = px[i + 1] / 255;
      const b0 = px[i + 2] / 255;

      let lum = r0 * 0.299 + g0 * 0.587 + b0 * 0.114;

      if (lum > 0.82) {
        lum = 0.82 + (lum - 0.82) * 0.28;
      }

      lum = (lum - blackPoint) / (whitePoint - blackPoint);
      lum = Math.max(0, Math.min(1, lum));
      lum = Math.pow(lum, gamma) * 0.78 + lift;

      let r = lum * 0.96 + 0.03;
      let g = lum * 0.94 + 0.028;
      let b = lum * 0.9 + 0.026;

      const dist = Math.hypot(x - cx, y - cy) / maxR;
      const vignette = 1 - dist * dist * 0.14;
      r *= vignette;
      g *= vignette;
      b *= vignette;

      px[i] = Math.round(Math.min(1, Math.max(0, r)) * 255);
      px[i + 1] = Math.round(Math.min(1, Math.max(0, g)) * 255);
      px[i + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255);
    }
  }
}

async function vintageTextureFromBytes(
  buf: ArrayBuffer,
): Promise<THREE.Texture | null> {
  const mime = imageMimeFromBuffer(buf);
  const url = URL.createObjectURL(new Blob([buf], { type: mime }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image_decode_failed"));
      el.src = url;
    });

    const maxDim = 2048;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) return null;
    if (Math.max(w, h) > maxDim) {
      const s = maxDim / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    gradeWallPhotoGrey(imageData);
    ctx.putImageData(imageData, 0, 0);

    const tex = configureLoadedTexture(new THREE.CanvasTexture(canvas));
    tex.flipY = true;
    return tex;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadTextureFromCandidates(
  candidates: string[],
  vintage: boolean,
): Promise<THREE.Texture | null> {
  for (const candidate of candidates) {
    try {
      const buf = await resolveImageBytes(candidate);
      if (!buf?.byteLength) continue;
      const tex = vintage
        ? await vintageTextureFromBytes(buf)
        : await textureFromBytes(buf);
      if (tex) return tex;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Decode image bytes into a GPU texture. Tries primary src then optional fallbacks. */
export async function loadImageTextureFromSrc(
  src: string,
  fallbacks: string[] = [],
): Promise<THREE.Texture | null> {
  const candidates = [src, ...fallbacks].filter(
    (s, i, arr) => s.length > 0 && arr.indexOf(s) === i,
  );
  return loadTextureFromCandidates(candidates, false);
}

/** Wall-hung print: muted grey albumen tone like the built-in GLB photos. */
export async function loadVintageWallTextureFromSrc(
  src: string,
  fallbacks: string[] = [],
): Promise<THREE.Texture | null> {
  const candidates = [src, ...fallbacks].filter(
    (s, i, arr) => s.length > 0 && arr.indexOf(s) === i,
  );
  return loadTextureFromCandidates(candidates, true);
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
