"use client";

import type { ModelAxis } from "@/lib/modelPlacement";

type ModelAdjustControlsProps = {
  onNudge: (deltaX: number, deltaY: number, deltaZ: number) => void;
  onRotate: (axis: ModelAxis, sign: 1 | -1) => void;
  onScale: (axis: ModelAxis | "uniform", zoomIn: boolean) => void;
  onRemove: () => void;
  compact?: boolean;
};

const btnCls =
  "museum-sans flex h-8 min-w-[2.1rem] items-center justify-center rounded-sm border border-[var(--museum-rule)] bg-[var(--museum-paper)] px-1 text-[10px] font-semibold text-[var(--museum-ink)] transition hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)]";

const actionCls =
  "museum-sans rounded-sm border border-[var(--museum-rule)] px-2 py-1.5 text-[11px] font-semibold text-[var(--museum-ink)] transition hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)]";

function AxisRow({
  label,
  onMinus,
  onPlus,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="museum-sans w-10 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--museum-muted)]">
        {label}
      </span>
      <button type="button" className={btnCls} onClick={onMinus}>
        −
      </button>
      <button type="button" className={btnCls} onClick={onPlus}>
        +
      </button>
    </div>
  );
}

export function ModelAdjustControls({
  onNudge,
  onRotate,
  onScale,
  onRemove,
  compact = false,
}: ModelAdjustControlsProps) {
  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-2.5"}`}>
      <div className="space-y-1">
        <p className="museum-sans text-[10px] font-semibold uppercase tracking-wide text-[var(--museum-muted)]">
          Move
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <AxisRow
            label="X"
            onMinus={() => onNudge(-1, 0, 0)}
            onPlus={() => onNudge(1, 0, 0)}
          />
          <AxisRow
            label="Y"
            onMinus={() => onNudge(0, -1, 0)}
            onPlus={() => onNudge(0, 1, 0)}
          />
          <AxisRow
            label="Z"
            onMinus={() => onNudge(0, 0, -1)}
            onPlus={() => onNudge(0, 0, 1)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <p className="museum-sans text-[10px] font-semibold uppercase tracking-wide text-[var(--museum-muted)]">
          Rotate
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <AxisRow
            label="X"
            onMinus={() => onRotate("x", -1)}
            onPlus={() => onRotate("x", 1)}
          />
          <AxisRow
            label="Y"
            onMinus={() => onRotate("y", -1)}
            onPlus={() => onRotate("y", 1)}
          />
          <AxisRow
            label="Z"
            onMinus={() => onRotate("z", -1)}
            onPlus={() => onRotate("z", 1)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <p className="museum-sans text-[10px] font-semibold uppercase tracking-wide text-[var(--museum-muted)]">
          Scale
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <AxisRow
            label="X"
            onMinus={() => onScale("x", false)}
            onPlus={() => onScale("x", true)}
          />
          <AxisRow
            label="Y"
            onMinus={() => onScale("y", false)}
            onPlus={() => onScale("y", true)}
          />
          <AxisRow
            label="Z"
            onMinus={() => onScale("z", false)}
            onPlus={() => onScale("z", true)}
          />
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <button
            type="button"
            className={actionCls}
            onClick={() => onScale("uniform", false)}
          >
            Uniform −
          </button>
          <button
            type="button"
            className={actionCls}
            onClick={() => onScale("uniform", true)}
          >
            Uniform +
          </button>
        </div>
      </div>

      <button
        type="button"
        className={`${actionCls} border-red-900/25 text-red-950/85 hover:bg-red-950/[0.05]`}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}
