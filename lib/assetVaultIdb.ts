const DB_NAME = "3d-home-asset-vault";
const DB_VER = 1;
const STORE = "assets";

export const INDEXEDDB_REF_PREFIX = "indexeddb:" as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDbRef(s: string): boolean {
  return s.startsWith(INDEXEDDB_REF_PREFIX);
}

/** Returns id without prefix, or null. */
export function indexedDbAssetId(ref: string): string | null {
  if (!isIndexedDbRef(ref)) return null;
  const id = ref.slice(INDEXEDDB_REF_PREFIX.length);
  return id.length ? id : null;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexeddb_unavailable"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onblocked = () => reject(new Error("indexeddb_blocked"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("indexeddb_open_failed"));
  });
}

export function getAssetVaultDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

export type VaultAssetKind = "glb" | "image";

export async function putVaultAsset(
  id: string,
  kind: VaultAssetKind,
  buffer: ArrayBuffer,
): Promise<void> {
  const db = await getAssetVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      id,
      kind,
      buffer,
      updatedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexeddb_put_failed"));
    tx.onabort = () => reject(tx.error ?? new Error("indexeddb_put_abort"));
  });
}

export async function getVaultAssetBuffer(id: string): Promise<ArrayBuffer | null> {
  try {
    const db = await getAssetVaultDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => {
        const row = req.result as { buffer?: ArrayBuffer } | undefined;
        resolve(row?.buffer ?? null);
      };
      req.onerror = () =>
        reject(req.error ?? new Error("indexeddb_get_failed"));
    });
  } catch {
    return null;
  }
}

export async function deleteVaultAsset(id: string): Promise<void> {
  try {
    const db = await getAssetVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("indexeddb_delete_failed"));
      tx.onabort = () =>
        reject(tx.error ?? new Error("indexeddb_delete_abort"));
    });
  } catch {
    /* offline / blocked */
  }
}
