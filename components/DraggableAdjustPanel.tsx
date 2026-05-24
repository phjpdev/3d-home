"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type DraggableAdjustPanelProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Resets drag position when the selected item changes. */
  resetKey?: string | null;
  /** Default screen anchor before drag offset is applied. */
  anchor?: "bottom-center" | "top-left";
};

export function DraggableAdjustPanel({
  title,
  onClose,
  children,
  resetKey = null,
  anchor = "bottom-center",
}: DraggableAdjustPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pointerId = useRef<number | null>(null);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
  }, [resetKey]);

  const clampOffset = useCallback((x: number, y: number) => {
    const maxX = Math.max(120, window.innerWidth * 0.38);
    const maxY = Math.max(120, window.innerHeight * 0.45);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }, []);

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;

      dragging.current = true;
      pointerId.current = e.pointerId;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [offset.x, offset.y],
  );

  const onHeaderPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current || pointerId.current !== e.pointerId) return;

      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setOffset(
        clampOffset(
          dragStart.current.offsetX + dx,
          anchor === "top-left"
            ? dragStart.current.offsetY + dy
            : dragStart.current.offsetY - dy,
        ),
      );
    },
    [anchor, clampOffset],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null && e.pointerId !== pointerId.current) return;
    dragging.current = false;
    pointerId.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const panelStyle =
    anchor === "top-left"
      ? {
          left: "calc(min(22rem, calc(100vw - 1.5rem)) + 1.5rem)",
          top: "clamp(7.5rem, 34vh, 20rem)",
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }
      : {
          left: `calc(50% + ${offset.x}px)`,
          bottom: `calc(max(4.75rem, env(safe-area-inset-bottom)) + ${offset.y}px)`,
          transform: "translateX(-50%)",
        };

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <div
        ref={panelRef}
        className="pointer-events-auto absolute w-[min(100%,28rem)] max-w-md"
        style={panelStyle}
      >
        <div className="rounded-sm border border-[var(--museum-brass-dark)]/40 bg-[var(--museum-parchment)]/96 px-3 py-2.5 shadow-md backdrop-blur-sm">
          <div
            className="relative mb-2 flex cursor-grab touch-none select-none items-start justify-center active:cursor-grabbing"
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <p className="museum-sans pr-8 text-center text-[11px] font-medium text-[var(--museum-ink)] sm:text-xs">
              {title}
            </p>
            <button
              type="button"
              aria-label="Close adjust panel"
              onClick={onClose}
              className="museum-sans absolute right-0 top-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm text-lg leading-none text-[var(--museum-muted)] transition hover:bg-black/[0.06] hover:text-[var(--museum-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)]"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
