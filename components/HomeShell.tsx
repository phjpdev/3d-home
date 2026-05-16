"use client";

import dynamic from "next/dynamic";

const HouseViewer = dynamic(() => import("@/components/HouseViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-zinc-100 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
      Loading 3D viewer…
    </div>
  ),
});

export default function HomeShell() {
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <HouseViewer />
    </div>
  );
}
