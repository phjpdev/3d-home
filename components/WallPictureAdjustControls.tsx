"use client";

type WallPictureAdjustControlsProps = {
  onNudge: (deltaRight: number, deltaUp: number) => void;
  onZoom: (zoomIn: boolean) => void;
  onRemove: () => void;
  compact?: boolean;
};

const btnCls =
  "museum-sans flex h-9 min-w-9 items-center justify-center rounded-sm border border-[var(--museum-rule)] bg-[var(--museum-paper)] text-xs font-semibold text-[var(--museum-ink)] transition hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)]";

const actionCls =
  "museum-sans rounded-sm border border-[var(--museum-rule)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--museum-ink)] transition hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)]";

export function WallPictureAdjustControls({
  onNudge,
  onZoom,
  onRemove,
  compact = false,
}: WallPictureAdjustControlsProps) {
  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-2.5"}`}>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          className={btnCls}
          aria-label="Move left"
          onClick={() => onNudge(-1, 0)}
        >
          ←
        </button>
        <button
          type="button"
          className={btnCls}
          aria-label="Move up"
          onClick={() => onNudge(0, 1)}
        >
          ↑
        </button>
        <button
          type="button"
          className={btnCls}
          aria-label="Move down"
          onClick={() => onNudge(0, -1)}
        >
          ↓
        </button>
        <button
          type="button"
          className={btnCls}
          aria-label="Move right"
          onClick={() => onNudge(1, 0)}
        >
          →
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          className={actionCls}
          onClick={() => onZoom(false)}
        >
          Zoom out
        </button>
        <button type="button" className={actionCls} onClick={() => onZoom(true)}>
          Zoom in
        </button>
        <button
          type="button"
          className={`${actionCls} border-red-900/25 text-red-950/85 hover:bg-red-950/[0.05]`}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
