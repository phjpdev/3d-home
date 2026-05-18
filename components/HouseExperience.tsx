"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  startTransition,
  useCallback,
  useEffect,
  useState,
} from "react";
import type { HouseViewMode } from "@/components/HouseViewer";
import {
  readStoredAssetLibrary,
  writeStoredAssetLibrary,
  type HouseSiteMode,
  type LibraryItem,
} from "@/lib/assetLibrary";
import type { SceneRegistry } from "@/lib/sceneRegistry";

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
  wallImageSrc: string | null;
  setWallSrc: (next: string | null) => void;
  modelsLibrary: LibraryItem[];
  imagesLibrary: LibraryItem[];
  setAssetLibraries: (
    next:
      | AssetLibrariesState
      | ((prev: AssetLibrariesState) => AssetLibrariesState),
  ) => void;
};

export type HouseExperienceProps = {
  siteMode: HouseSiteMode;
  placementPanel?: (ctx: PlacementPanelContext) => React.ReactNode;
};

const STORAGE_ASSIGNMENTS_KEY = "3d-home:furniture-assignments";
const STORAGE_WALL_PREFIX = "3d-home:wall-image:";

export function readStoredAssignments(
  siteMode: HouseSiteMode,
): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_ASSIGNMENTS_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    return all?.[siteMode] ?? {};
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

function readStoredWall(siteMode: HouseSiteMode): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${STORAGE_WALL_PREFIX}${siteMode}`);
  } catch {
    return null;
  }
}

function writeStoredWall(siteMode: HouseSiteMode, dataUrl: string | null) {
  if (typeof window === "undefined") return;
  try {
    const k = `${STORAGE_WALL_PREFIX}${siteMode}`;
    if (!dataUrl) localStorage.removeItem(k);
    else localStorage.setItem(k, dataUrl);
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

  const [wallImageSrc, setWallImageSrcState] = useState<string | null>(null);

  const [assetLibraries, setAssetLibrariesState] = useState<AssetLibrariesState>({
    models: [],
    images: [],
  });

  useEffect(() => {
    startTransition(() => {
      setFurnitureAssignments(readStoredAssignments(siteMode));
      setWallImageSrcState(readStoredWall(siteMode));
      setAssetLibrariesState(readStoredAssetLibrary(siteMode));
    });
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
        window.dispatchEvent(new CustomEvent("house-storage-updated"));
        return resolved;
      });
    },
    [siteMode],
  );

  const setWallSrc = useCallback(
    (next: string | null) => {
      setWallImageSrcState(next);
      writeStoredWall(siteMode, next);
      window.dispatchEvent(new CustomEvent("house-storage-updated"));
    },
    [siteMode],
  );

  const setAssetLibraries = useCallback(
    (
      next:
        | AssetLibrariesState
        | ((prev: AssetLibrariesState) => AssetLibrariesState),
    ) => {
      setAssetLibrariesState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        writeStoredAssetLibrary(siteMode, resolved);
        window.dispatchEvent(new CustomEvent("house-storage-updated"));
        return resolved;
      });
    },
    [siteMode],
  );

  useEffect(() => {
    const sync = () => {
      startTransition(() => {
        setFurnitureAssignments(readStoredAssignments(siteMode));
        setWallImageSrcState(readStoredWall(siteMode));
        setAssetLibrariesState(readStoredAssetLibrary(siteMode));
      });
    };
    window.addEventListener("storage", sync);
    window.addEventListener("house-storage-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("house-storage-updated", sync);
    };
  }, [siteMode]);

  const handleRegistry = useCallback((info: { registry: SceneRegistry }) => {
    setRegistry(info.registry);
  }, []);

  const walkStrict = siteMode === "walk";

  const placementContext: PlacementPanelContext | null =
    placementPanel && siteMode === "edit"
      ? {
          registry,
          assignments: furnitureAssignments,
          setAssignments,
          wallImageSrc,
          setWallSrc,
          modelsLibrary: assetLibraries.models,
          imagesLibrary: assetLibraries.images,
          setAssetLibraries,
        }
      : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--museum-parchment)]">
      <div className="absolute inset-0 z-0 min-h-0">
        <HouseViewer
          viewMode={viewMode}
          walkStrict={walkStrict}
          furnitureAssignments={furnitureAssignments}
          wallImageSrc={wallImageSrc}
          onRegistry={handleRegistry}
        />
      </div>

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
