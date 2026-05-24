"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { HouseViewMode } from "@/components/HouseViewer";
import {
  hydrateAssetLibraryFromVault,
  migrateHeavyDataUrlsToVault,
  readStoredAssetLibrary,
  writeStoredAssetLibrary,
  type HouseSiteMode,
  type LibraryItem,
} from "@/lib/assetLibrary";
import type { SceneRegistry } from "@/lib/sceneRegistry";
import {
  libraryBlobFallbackForRef,
} from "@/lib/imageVaultTexture";
import {
  loadImageAspect,
  newPlacementId,
  readStoredWallPlacements,
  writeStoredWallPlacements,
  type WallPicturePlacement,
} from "@/lib/wallPicturePlacement";

export type { HouseSiteMode } from "@/lib/assetLibrary";

const HouseViewer = dynamic(() => import("@/components/HouseViewer"), {
  ssr: false,
  loading: () => (
    <div className="museum-sans flex h-full min-h-0 w-full flex-1 items-center justify-center bg-[var(--museum-parchment)] text-[var(--museum-muted)]">
      Preparing gallery…
    </div>
  ),
});

export type AssetLibrariesState = {
  models: LibraryItem[];
  images: LibraryItem[];
};

export type PlacementPanelContext = {
  registry: SceneRegistry;
  assignments: Record<string, string>;
  setAssignments: (
    next:
      | Record<string, string>
      | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  wallPlacements: WallPicturePlacement[];
  setWallPlacements: (
    next:
      | WallPicturePlacement[]
      | ((prev: WallPicturePlacement[]) => WallPicturePlacement[]),
  ) => void;
  pendingWallImage: string | null;
  setPendingWallImage: (next: string | null) => void;
  modelsLibrary: LibraryItem[];
  imagesLibrary: LibraryItem[];
  setAssetLibraries: (
    next:
      | AssetLibrariesState
      | ((prev: AssetLibrariesState) => AssetLibrariesState),
  ) => void;
  /** Shown after a failed asset-library write (e.g. localStorage quota). */
  libraryPersistNotice: string | null;
  dismissLibraryPersistNotice: () => void;
};

export type HouseExperienceProps = {
  siteMode: HouseSiteMode;
  placementPanel?: (ctx: PlacementPanelContext) => React.ReactNode;
};

const STORAGE_ASSIGNMENTS_KEY = "3d-home:furniture-assignments";
function sanitizeAssignments(
  assignments: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [slotId, src] of Object.entries(assignments)) {
    if (typeof src !== "string" || src.length === 0) continue;
    if (src.startsWith("blob:")) continue;
    /** `indexeddb:…` survives reload via vault */
    next[slotId] = src;
  }
  return next;
}

export function readStoredAssignments(
  siteMode: HouseSiteMode,
): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_ASSIGNMENTS_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    const bucketRaw = all?.[siteMode] ?? {};
    const cleaned = sanitizeAssignments(bucketRaw);
    if (
      Object.keys(cleaned).length !== Object.keys(bucketRaw).length ||
      Object.entries(cleaned).some(([k, v]) => bucketRaw[k] !== v)
    ) {
      all[siteMode] = cleaned;
      localStorage.setItem(STORAGE_ASSIGNMENTS_KEY, JSON.stringify(all));
    }
    return cleaned;
  } catch {
    return {};
  }
}

function writeStoredAssignments(
  siteMode: HouseSiteMode,
  next: Record<string, string>,
) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_ASSIGNMENTS_KEY);
    const all = (raw ? JSON.parse(raw) : {}) as Record<
      string,
      Record<string, string>
    >;
    all[siteMode] = next;
    localStorage.setItem(STORAGE_ASSIGNMENTS_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

const overlayNeutralBtnCls =
  "inline-flex min-h-11 min-w-[7.5rem] cursor-pointer items-center justify-center rounded-sm border border-white/45 bg-black/52 px-5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-black/62 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/90 no-underline";

export default function HouseExperience({
  siteMode,
  placementPanel,
}: HouseExperienceProps) {
  const [registry, setRegistry] = useState<SceneRegistry>({ slots: [] });

  const [viewMode, setViewMode] = useState<HouseViewMode>(() =>
    siteMode === "walk" ? "walk" : "overview",
  );

  useEffect(() => {
    startTransition(() => {
      setViewMode(siteMode === "walk" ? "walk" : "overview");
    });
  }, [siteMode]);

  const [furnitureAssignments, setFurnitureAssignments] = useState<
    Record<string, string>
  >({});

  const [wallPlacements, setWallPlacementsState] = useState<
    WallPicturePlacement[]
  >([]);

  const [pendingWallImage, setPendingWallImageState] = useState<string | null>(
    null,
  );
  const [pendingWallAspect, setPendingWallAspect] = useState(4 / 3);
  const [placementMissNotice, setPlacementMissNotice] = useState(false);

  const [assetLibraries, setAssetLibrariesState] = useState<AssetLibrariesState>({
    models: [],
    images: [],
  });

  const [libraryPersistNotice, setLibraryPersistNotice] = useState<
    string | null
  >(null);

  const dismissLibraryPersistNotice = useCallback(() => {
    setLibraryPersistNotice(null);
  }, []);

  useEffect(() => {
    let cancel = false;
    startTransition(() => {
      setFurnitureAssignments(readStoredAssignments(siteMode));
      setWallPlacementsState(readStoredWallPlacements(siteMode));
    });

    void (async () => {
      try {
        await migrateHeavyDataUrlsToVault(siteMode);
      } catch {
        /* IDB unavailable */
      }
      const meta = readStoredAssetLibrary(siteMode);
      try {
        const hydrated = await hydrateAssetLibraryFromVault(meta);
        if (!cancel) {
          startTransition(() => {
            setAssetLibrariesState(hydrated);
            setWallPlacementsState(readStoredWallPlacements(siteMode));
          });
        }
      } catch {
        if (!cancel) {
          startTransition(() => {
            setAssetLibrariesState(meta);
            setWallPlacementsState(readStoredWallPlacements(siteMode));
          });
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [siteMode]);

  const setAssignments = useCallback(
    (
      next:
        | Record<string, string>
        | ((prev: Record<string, string>) => Record<string, string>),
    ) => {
      setFurnitureAssignments((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        writeStoredAssignments(siteMode, resolved);
        return resolved;
      });
    },
    [siteMode],
  );

  const setWallPlacements = useCallback(
    (
      next:
        | WallPicturePlacement[]
        | ((prev: WallPicturePlacement[]) => WallPicturePlacement[]),
    ) => {
      setWallPlacementsState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        writeStoredWallPlacements(siteMode, resolved);
        return resolved;
      });
    },
    [siteMode],
  );

  const setPendingWallImage = useCallback(
    (next: string | null) => {
      setPendingWallImageState(next);
      setPlacementMissNotice(false);
      if (next) {
        const fb = libraryBlobFallbackForRef(next, assetLibraries.images);
        void loadImageAspect(next, fb ? [fb] : []).then(setPendingWallAspect);
      }
    },
    [assetLibraries.images],
  );

  const cancelWallPlacement = useCallback(() => {
    setPendingWallImageState(null);
    setPlacementMissNotice(false);
  }, []);

  const handleWallPlaced = useCallback(
    (placement: Omit<WallPicturePlacement, "id">) => {
      setWallPlacements((prev) => [
        ...prev,
        { ...placement, id: newPlacementId() },
      ]);
      setPendingWallImageState(null);
      setPlacementMissNotice(false);
    },
    [setWallPlacements],
  );

  const handleWallPlacementMissed = useCallback(() => {
    setPlacementMissNotice(true);
  }, []);

  const setAssetLibraries = useCallback(
    (
      next:
        | AssetLibrariesState
        | ((prev: AssetLibrariesState) => AssetLibrariesState),
    ) => {
      setAssetLibrariesState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        const ok = writeStoredAssetLibrary(siteMode, resolved);
        queueMicrotask(() => {
          setLibraryPersistNotice(
            ok
              ? null
              : "Could not save the asset list to browser storage (localStorage). Try freeing space or clear site data.",
          );
        });
        return resolved;
      });
    },
    [siteMode],
  );

  useEffect(() => {
    const sync = () => {
      startTransition(() => {
        setFurnitureAssignments(readStoredAssignments(siteMode));
        setWallPlacementsState(readStoredWallPlacements(siteMode));
      });

      void (async () => {
        try {
          await migrateHeavyDataUrlsToVault(siteMode);
        } catch {
          /* ignore */
        }
        const meta = readStoredAssetLibrary(siteMode);
        try {
          const hydrated = await hydrateAssetLibraryFromVault(meta);
          startTransition(() => {
            setAssetLibrariesState(hydrated);
            setWallPlacementsState(readStoredWallPlacements(siteMode));
          });
        } catch {
          startTransition(() => {
            setAssetLibrariesState(meta);
            setWallPlacementsState(readStoredWallPlacements(siteMode));
          });
        }
      })();
    };
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
    };
  }, [siteMode]);

  const handleRegistry = useCallback((info: { registry: SceneRegistry }) => {
    setRegistry(info.registry);
  }, []);

  const walkStrict = siteMode === "walk";

  const pendingImageFallbacks = useMemo(() => {
    if (!pendingWallImage) return [];
    const fb = libraryBlobFallbackForRef(
      pendingWallImage,
      assetLibraries.images,
    );
    return fb ? [fb] : [];
  }, [pendingWallImage, assetLibraries.images]);

  const placementContext: PlacementPanelContext | null =
    placementPanel && siteMode === "edit"
      ? {
          registry,
          assignments: furnitureAssignments,
          setAssignments,
          wallPlacements,
          setWallPlacements,
          pendingWallImage,
          setPendingWallImage,
          modelsLibrary: assetLibraries.models,
          imagesLibrary: assetLibraries.images,
          setAssetLibraries,
          libraryPersistNotice,
          dismissLibraryPersistNotice,
        }
      : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--museum-parchment)]">
      <div className="absolute inset-0 z-0 min-h-0">
        <HouseViewer
          viewMode={viewMode}
          walkStrict={walkStrict}
          furnitureAssignments={furnitureAssignments}
          wallPlacements={wallPlacements}
          imagesLibrary={assetLibraries.images}
          pendingWallImage={pendingWallImage}
          pendingWallAspect={pendingWallAspect}
          pendingImageFallbacks={pendingImageFallbacks}
          onWallPlaced={handleWallPlaced}
          onCancelWallPlacement={cancelWallPlacement}
          onWallPlacementMissed={handleWallPlacementMissed}
          onRegistry={handleRegistry}
        />
      </div>

      {pendingWallImage ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3">
          <div className="pointer-events-auto flex max-w-md flex-wrap items-center justify-center gap-2 rounded-sm border border-[var(--museum-brass-dark)]/40 bg-[var(--museum-parchment)]/96 px-4 py-2.5 text-center shadow-md backdrop-blur-sm">
            <p className="museum-sans text-xs font-medium text-[var(--museum-ink)] sm:text-sm">
              {placementMissNotice
                ? "That click missed the wall — try again on the flat wall surface (not the floor or furniture)"
                : viewMode === "walk"
                  ? "Click the wall in front of you · drag to look around"
                  : "Click a wall to hang your picture · right-drag to orbit · scroll to zoom"}
            </p>
            <button
              type="button"
              onClick={cancelWallPlacement}
              className="museum-sans rounded-sm border border-[var(--museum-rule)] px-2.5 py-1 text-[11px] font-semibold text-[var(--museum-ink)] hover:bg-black/[0.04]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {placementContext && placementPanel ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex max-h-full items-stretch p-3">
          <div className="pointer-events-auto flex h-full max-h-full w-[min(22rem,calc(100vw-1.5rem))] min-w-[16.5rem] max-w-[40rem] resize-x flex-col overflow-hidden rounded-sm border border-[var(--museum-rule)] bg-[var(--museum-parchment)]/95 shadow-sm backdrop-blur-sm">
            {placementPanel(placementContext)}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none relative z-10 mt-auto flex flex-col justify-end">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          {siteMode === "edit" && viewMode === "overview" ? (
            <button
              type="button"
              onClick={() => setViewMode("walk")}
              className="museum-btn-primary min-h-11 min-w-[7.5rem] rounded-sm px-5 text-sm"
            >
              Walk inside
            </button>
          ) : null}
          {siteMode === "edit" && viewMode === "walk" ? (
            <button
              type="button"
              onClick={() => setViewMode("overview")}
              className={overlayNeutralBtnCls}
            >
              Overview
            </button>
          ) : null}
          <Link href="/" className={overlayNeutralBtnCls}>
            Foyer
          </Link>
        </div>
      </div>
    </div>
  );
}
