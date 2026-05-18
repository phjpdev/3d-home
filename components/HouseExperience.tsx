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
import type { SceneRegistry } from "@/lib/sceneRegistry";

const HouseViewer = dynamic(() => import("@/components/HouseViewer"), {
  ssr: false,
  loading: () => (
    <div className="museum-sans flex h-full min-h-0 w-full flex-1 items-center justify-center bg-[var(--museum-parchment)] text-[var(--museum-muted)]">
      Preparing gallery…
    </div>
  ),
});

export type HouseSiteMode = "edit" | "walk";

export type PlacementPanelContext = {
  registry: SceneRegistry;
  assignments: Record<string, string>;
  setAssignments: (next: Record<string, string>) => void;
  wallImageSrc: string | null;
  setWallSrc: (next: string | null) => void;
};

export type HouseExperienceProps = {
  siteMode: HouseSiteMode;
  placementPanel?: (ctx: PlacementPanelContext) => React.ReactNode;
};

const STORAGE_ASSIGNMENTS_KEY = "3d-home:furniture-assignments";
const STORAGE_WALL_PREFIX = "3d-home:wall-image:";

export function readStoredAssignments(siteMode: HouseSiteMode): Record<string, string> {
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
    const all = (raw ? JSON.parse(raw) : {}) as Record<string, Record<string, string>>;
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

  useEffect(() => {
    startTransition(() => {
      setFurnitureAssignments(readStoredAssignments(siteMode));
      setWallImageSrcState(readStoredWall(siteMode));
    });
  }, [siteMode]);

  const setAssignments = useCallback(
    (next: Record<string, string>) => {
      setFurnitureAssignments(next);
      writeStoredAssignments(siteMode, next);
      window.dispatchEvent(new CustomEvent("house-storage-updated"));
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

  useEffect(() => {
    const sync = () => {
      startTransition(() => {
        setFurnitureAssignments(readStoredAssignments(siteMode));
        setWallImageSrcState(readStoredWall(siteMode));
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
        <div className="pointer-events-none absolute left-0 top-0 z-20 flex max-h-full w-full max-w-full justify-start p-3 sm:max-w-sm">
          <div className="pointer-events-auto max-h-[min(88dvh,42rem)] w-full overflow-y-auto rounded-sm border border-[var(--museum-rule)] bg-[var(--museum-parchment)]/95 p-4 shadow-sm backdrop-blur-sm">
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
