export type HouseSiteMode = "edit" | "walk";

export type LibraryItem = {
  id: string;
  kind: "glb" | "image";
  src: string;
  label: string;
};

const STORAGE_KEY = "3d-home:asset-library";

type StoredShape = Record<
  string,
  { models: LibraryItem[]; images: LibraryItem[] }
>;

function empty(): { models: LibraryItem[]; images: LibraryItem[] } {
  return { models: [], images: [] };
}

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
    return {
      models: Array.isArray(bucket.models) ? bucket.models : [],
      images: Array.isArray(bucket.images) ? bucket.images : [],
    };
  } catch {
    return empty();
  }
}

export function writeStoredAssetLibrary(
  siteMode: HouseSiteMode,
  next: { models: LibraryItem[]; images: LibraryItem[] },
) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = (raw ? JSON.parse(raw) : {}) as StoredShape;
    all[siteMode] = {
      models: next.models.filter((i) => i.kind === "glb"),
      images: next.images.filter((i) => i.kind === "image"),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}

export function appendGeneratedGlbToEditLibrary(glbUrl: string, label: string) {
  if (typeof window === "undefined") return;
  const trimmed = glbUrl.trim();
  if (!trimmed) return;
  const prev = readStoredAssetLibrary("edit");
  const item: LibraryItem = {
    id: newLibraryId(),
    kind: "glb",
    src: trimmed,
    label: label.trim() || "Generated model",
  };
  writeStoredAssetLibrary("edit", {
    models: [...prev.models, item],
    images: prev.images,
  });
  window.dispatchEvent(new CustomEvent("house-storage-updated"));
}

export function newLibraryId(): string {
  return `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
