import {
  getVaultAssetBuffer,
  INDEXEDDB_REF_PREFIX,
  isIndexedDbRef,
  putVaultAsset,
} from "@/lib/assetVaultIdb";

export type HouseSiteMode = "edit" | "walk";

/** In-memory shape for UI and loaders (`src` is always a usable URL-like string). */
export type LibraryItem = {
  id: string;
  kind: "glb" | "image";
  src: string;
  label: string;
  /** GLB/image bytes persisted in IndexedDB under `id`; `src` becomes a blob: URL once hydrated */
  vaultBacked?: boolean;
};

/** Small JSON persisted in localStorage (no binaries). */
type PersistedLibraryItem = {
  id: string;
  kind: "glb" | "image";
  label: string;
  /** HTTPS / Meshy URLs, short data URLs from legacy installs, `/api/...`, etc. */
  remoteSrc?: string;
  /** Payload stored in IndexedDB under `id` */
  vault?: boolean;
};

const STORAGE_KEY = "3d-home:asset-library";

type StoredShape = Record<
  string,
  {
    models: PersistedLibraryItem[];
    images: PersistedLibraryItem[];
  }
>;

const DATA_URL_MIGRATE_MIN_CHARS = 80_000;

function empty(): { models: LibraryItem[]; images: LibraryItem[] } {
  return { models: [], images: [] };
}

function dedupeLibraryById<
  T extends { id?: string },
>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (!it?.id || seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

function runtimeFromPersisted(p: PersistedLibraryItem): LibraryItem {
  if (p.vault) {
    return {
      id: p.id,
      kind: p.kind,
      label: p.label,
      src: `${INDEXEDDB_REF_PREFIX}${p.id}`,
      vaultBacked: true,
    };
  }
  return {
    id: p.id,
    kind: p.kind,
    label: p.label,
    src: p.remoteSrc ?? "",
    vaultBacked: false,
  };
}

/** Strip runtime-only refs before saving to localStorage. */
export function persistLibraryItem(it: LibraryItem): PersistedLibraryItem {
  if (
    it.vaultBacked ||
    isIndexedDbRef(it.src) ||
    (it.src && it.src.startsWith("blob:"))
  ) {
    return { id: it.id, kind: it.kind, label: it.label, vault: true };
  }
  return {
    id: it.id,
    kind: it.kind,
    label: it.label,
    remoteSrc: it.src,
  };
}

export function normalizedIndexedDbPlacementRef(modelId: string): string {
  return `${INDEXEDDB_REF_PREFIX}${modelId}`;
}

export function refsMatchingLibraryItem(it: LibraryItem): string[] {
  const refs = new Set<string>();
  if (it.src) refs.add(it.src);
  refs.add(normalizedIndexedDbPlacementRef(it.id));
  return [...refs];
}

function normalizeStoredRow(raw: unknown): PersistedLibraryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.label !== "string") return null;
  if (o.kind !== "glb" && o.kind !== "image") return null;
  const kind = o.kind;
  if (o.vault === true) {
    return { id: o.id, kind, label: o.label, vault: true };
  }
  if (typeof o.remoteSrc === "string" && o.remoteSrc.length > 0) {
    return { id: o.id, kind, label: o.label, remoteSrc: o.remoteSrc };
  }
  if (typeof o.src === "string" && o.src.length > 0) {
    if (isIndexedDbRef(o.src))
      return { id: o.id, kind, label: o.label, vault: true };
    return { id: o.id, kind, label: o.label, remoteSrc: o.src };
  }
  return { id: o.id, kind, label: o.label, vault: true };
}

/** Sync read: returns metadata; vault rows use src `indexeddb:id` until hydrate runs */
export function readStoredAssetLibrary(
  siteMode: HouseSiteMode,
): { models: LibraryItem[]; images: LibraryItem[] } {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const all = JSON.parse(raw) as StoredShape;
    const bucket = all?.[siteMode];
    if (!bucket) return empty();
    const rawModels = Array.isArray(bucket.models) ? bucket.models : [];
    const rawImages = Array.isArray(bucket.images) ? bucket.images : [];
    const models = dedupeLibraryById(
      rawModels
        .map((row) => normalizeStoredRow(row))
        .filter((x): x is PersistedLibraryItem => x !== null)
        .map(runtimeFromPersisted),
    ).filter((m) => m.src.length > 0 || m.vaultBacked);
    const images = dedupeLibraryById(
      rawImages
        .map((row) => normalizeStoredRow(row))
        .filter((x): x is PersistedLibraryItem => x !== null)
        .map(runtimeFromPersisted),
    ).filter((m) => m.src.length > 0 || m.vaultBacked);
    return { models, images };
  } catch {
    return empty();
  }
}

/** Fill blob: URLs for vault-backed rows (reload-safe). */
export async function hydrateAssetLibraryFromVault(lib: {
  models: LibraryItem[];
  images: LibraryItem[];
}): Promise<{ models: LibraryItem[]; images: LibraryItem[] }> {
  async function hydrateList(items: LibraryItem[]): Promise<LibraryItem[]> {
    const out: LibraryItem[] = [];
    for (const it of items) {
      if (!it.vaultBacked && !isIndexedDbRef(it.src)) {
        out.push(it);
        continue;
      }
      const id = isIndexedDbRef(it.src)
        ? it.src.slice(INDEXEDDB_REF_PREFIX.length)
        : it.id;
      const buf = await getVaultAssetBuffer(id);
      if (!buf || buf.byteLength === 0) continue;
      const blob =
        it.kind === "glb"
          ? new Blob([buf], { type: "model/gltf-binary" })
          : new Blob([buf]);
      const url = URL.createObjectURL(blob);
      out.push({ ...it, id, src: url, vaultBacked: true });
    }
    return out;
  }
  return {
    models: await hydrateList(lib.models),
    images: await hydrateList(lib.images),
  };
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
  try {
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    const meta = dataUrl.slice(0, comma);
    const body = dataUrl.slice(comma + 1);
    if (meta.includes(";base64")) {
      const bin = atob(body);
      const len = bin.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
      return u8.buffer;
    }
    return new TextEncoder().encode(decodeURIComponent(body)).buffer;
  } catch {
    return null;
  }
}

async function migrateHeavyDataUrlsInBucket(
  list: PersistedLibraryItem[],
  kind: "glb" | "image",
): Promise<PersistedLibraryItem[]> {
  const next: PersistedLibraryItem[] = [];
  for (const row of list) {
    let p = row;
    if (
      !p.vault &&
      typeof p.remoteSrc === "string" &&
      p.remoteSrc.startsWith("data:") &&
      p.remoteSrc.length >= DATA_URL_MIGRATE_MIN_CHARS
    ) {
      const buf = dataUrlToArrayBuffer(p.remoteSrc);
      if (buf && buf.byteLength > 0) {
        try {
          await putVaultAsset(p.id, kind, buf);
          p = {
            id: p.id,
            kind: p.kind,
            label: p.label,
            vault: true,
          };
        } catch {
          /* leave as remoteSrc fallback */
        }
      }
    }
    next.push(p);
  }
  return next;
}

/** Move huge legacy base64 payloads from localStorage into IndexedDB once. */
export async function migrateHeavyDataUrlsToVault(siteMode: HouseSiteMode): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const all = JSON.parse(raw) as StoredShape;
    const bucket = all?.[siteMode];
    if (!bucket) return false;
    const prevModels = Array.isArray(bucket.models) ? bucket.models : [];
    const prevImages = Array.isArray(bucket.images) ? bucket.images : [];
    const modelsNorm = dedupeLibraryById(
      prevModels
        .map((row) => normalizeStoredRow(row))
        .filter((x): x is PersistedLibraryItem => x !== null),
    );
    const imagesNorm = dedupeLibraryById(
      prevImages
        .map((row) => normalizeStoredRow(row))
        .filter((x): x is PersistedLibraryItem => x !== null),
    );
    const models = await migrateHeavyDataUrlsInBucket(modelsNorm, "glb");
    const images = await migrateHeavyDataUrlsInBucket(imagesNorm, "image");
    const changed =
      JSON.stringify(models) !== JSON.stringify(modelsNorm) ||
      JSON.stringify(images) !== JSON.stringify(imagesNorm);
    if (changed) {
      all[siteMode] = { models, images };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }
    return changed;
  } catch {
    return false;
  }
}

export function writeStoredAssetLibrary(
  siteMode: HouseSiteMode,
  next: { models: LibraryItem[]; images: LibraryItem[] },
): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = (raw ? JSON.parse(raw) : {}) as StoredShape;
    const models = dedupeLibraryById(
      next.models
        .filter((i) => i.kind === "glb")
        .map(persistLibraryItem),
    );
    const images = dedupeLibraryById(
      next.images
        .filter((i) => i.kind === "image")
        .map(persistLibraryItem),
    );
    all[siteMode] = { models, images };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function newLibraryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `lib_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

export async function appendGeneratedGlbToEditLibrary(
  glbUrl: string,
  label: string,
) {
  if (typeof window === "undefined") return;
  const trimmed = glbUrl.trim();
  if (!trimmed) return;
  await migrateHeavyDataUrlsToVault("edit");
  const prev = readStoredAssetLibrary("edit");
  const item: LibraryItem = {
    id: newLibraryId(),
    kind: "glb",
    src: trimmed,
    label: label.trim() || "Generated model",
    vaultBacked: false,
  };
  const ok = writeStoredAssetLibrary("edit", {
    models: [...prev.models, item],
    images: prev.images,
  });
  if (!ok) {
    console.warn(
      "3d-home: could not save asset index to localStorage (quota or storage blocked).",
    );
  }
}
