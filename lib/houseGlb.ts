/** Canonical house scene served from /public (deploy the optimized asset from `npm run optimize:house-glb`). */
export const HOUSE_GLB_URL = "/EinsteinHouseDone.glb";

let preloadStarted = false;

/** Start downloading the house GLB before the Three.js viewer chunk loads. */
export function preloadHouseGlb(): void {
  if (preloadStarted || typeof window === "undefined") return;
  preloadStarted = true;

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "fetch";
  link.href = HOUSE_GLB_URL;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);

  void fetch(HOUSE_GLB_URL, { priority: "high" } as RequestInit).catch(() => {
    /* network errors are surfaced by the viewer loader */
  });
}
