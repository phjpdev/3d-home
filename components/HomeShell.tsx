"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { HouseViewMode } from "@/components/HouseViewer";

const HouseViewer = dynamic(() => import("@/components/HouseViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-zinc-100 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
      Loading 3D viewer…
    </div>
  ),
});

export default function HomeShell() {
  const [phase, setPhase] = useState<"landing" | "experience">("landing");
  const [viewMode, setViewMode] = useState<HouseViewMode>("overview");

  const enterHome = useCallback(() => {
    setPhase("experience");
    setViewMode("overview");
  }, []);

  const backToLanding = useCallback(() => {
    setPhase("landing");
    setViewMode("overview");
  }, []);

  const enterWalk = useCallback(() => {
    setViewMode("walk");
  }, []);

  const backWalkToOverview = useCallback(() => {
    setViewMode("overview");
  }, []);

  if (phase === "landing") {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center gap-8 bg-gradient-to-b from-zinc-100 to-zinc-200 px-6 text-center dark:from-zinc-950 dark:to-zinc-900">
        <div className="max-w-md space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            3D Home
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter to explore the model — orbit the exterior, then walk inside.
          </p>
        </div>
        <button
          type="button"
          onClick={enterHome}
          className="min-h-12 rounded-full bg-zinc-900 px-10 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Enter Home
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <div className="absolute inset-0">
        <HouseViewer viewMode={viewMode} />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        <div className="pointer-events-auto flex justify-end p-3">
          {viewMode === "overview" ? (
            <p className="max-w-[260px] text-right text-[11px] text-zinc-600 dark:text-zinc-400">
              Drag: left rotate · middle zoom · right pan
            </p>
          ) : (
            <p className="max-w-[280px] text-right text-[11px] text-zinc-600 dark:text-zinc-400">
              Move over the floor to aim · click to move · drag to look around
            </p>
          )}
        </div>

        {viewMode === "overview" ? (
          <div className="pointer-events-auto flex items-center justify-center gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            <button
              type="button"
              onClick={enterWalk}
              className="min-h-12 min-w-[8rem] rounded-full bg-white px-6 text-sm font-semibold text-zinc-900 shadow-lg active:scale-[0.98] dark:bg-zinc-800 dark:text-zinc-50"
            >
              Walk
            </button>
            <button
              type="button"
              onClick={backToLanding}
              className="min-h-12 min-w-[8rem] rounded-full border border-zinc-300 bg-zinc-800 px-6 text-sm font-semibold text-white shadow-lg active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-200 dark:text-zinc-900"
            >
              Back
            </button>
          </div>
        ) : (
          <div className="pointer-events-auto flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            <button
              type="button"
              onClick={backWalkToOverview}
              className="min-h-12 min-w-[8rem] rounded-full border border-zinc-300 bg-zinc-800 px-6 text-sm font-semibold text-white shadow-lg active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-200 dark:text-zinc-900"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
