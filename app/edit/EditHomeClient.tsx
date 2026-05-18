"use client";

import dynamicImport from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PlacementPanelContext } from "@/components/HouseExperience";
import HouseExperience from "@/components/HouseExperience";
import { newLibraryId, type LibraryItem } from "@/lib/assetLibrary";
import { viewerModelSrc } from "@/lib/modelUrl";

const GlbPreview = dynamicImport(() => import("@/components/GlbPreview"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(50vh,18rem)] items-center justify-center rounded-sm border border-[var(--museum-rule)] bg-[#1a1816]/80 text-[11px] text-white/65">
      Mounting viewer…
    </div>
  ),
});

type EditTab = "model" | "picture";

function stripAssignmentsUsingSrc(
  assignments: Record<string, string>,
  src: string,
): Record<string, string> {
  const next = { ...assignments };
  for (const [k, v] of Object.entries(next)) {
    if (v === src) delete next[k];
  }
  return next;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read_failed"));
    r.readAsDataURL(file);
  });
}

function EditPanel(context: PlacementPanelContext) {
  const {
    registry,
    setAssignments,
    wallImageSrc,
    setWallSrc,
    modelsLibrary,
    imagesLibrary,
    setAssetLibraries,
  } = context;

  const [editTab, setEditTab] = useState<EditTab>("model");

  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);
  const [placeSlotId, setPlaceSlotId] = useState("");

  useEffect(() => {
    if (!previewItem || previewItem.kind !== "glb") return;
    const first = registry.slots[0]?.id ?? "";
    setPlaceSlotId((prev) => {
      if (prev && registry.slots.some((s) => s.id === prev)) return prev;
      return first;
    });
  }, [previewItem, registry.slots]);

  const pushModel = useCallback(
    (src: string, label: string) => {
      const item: LibraryItem = {
        id: newLibraryId(),
        kind: "glb",
        src,
        label,
      };
      setAssetLibraries((prev) => ({
        models: [...prev.models, item],
        images: prev.images,
      }));
    },
    [setAssetLibraries],
  );

  const pushImage = useCallback(
    (src: string, label: string) => {
      const item: LibraryItem = {
        id: newLibraryId(),
        kind: "image",
        src,
        label,
      };
      setAssetLibraries((prev) => ({
        models: prev.models,
        images: [...prev.images, item],
      }));
    },
    [setAssetLibraries],
  );

  const removeLibraryItem = useCallback(
    (item: LibraryItem) => {
      if (item.kind === "glb") {
        setAssetLibraries((prev) => ({
          models: prev.models.filter((m) => m.id !== item.id),
          images: prev.images,
        }));
        setAssignments((prev) => stripAssignmentsUsingSrc(prev, item.src));
      } else {
        setAssetLibraries((prev) => ({
          models: prev.models,
          images: prev.images.filter((m) => m.id !== item.id),
        }));
        if (wallImageSrc === item.src) setWallSrc(null);
      }
    },
    [setAssetLibraries, setAssignments, setWallSrc, wallImageSrc],
  );

  const onUploadGlb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      pushModel(dataUrl, file.name);
    } catch {
      /* ignore */
    }
  };

  const onUploadPicture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      pushImage(dataUrl, file.name);
    } catch {
      /* ignore */
    }
  };

  const onModalDelete = () => {
    if (!previewItem) return;
    removeLibraryItem(previewItem);
    setPreviewItem(null);
  };

  const onModalPlace = () => {
    if (!previewItem) return;
    if (previewItem.kind === "glb") {
      const sid = placeSlotId || registry.slots[0]?.id;
      if (!sid) return;
      setAssignments((prev) => ({ ...prev, [sid]: previewItem.src }));
    } else {
      setWallSrc(previewItem.src);
    }
    setPreviewItem(null);
  };

  const tabBtn = (tab: EditTab, label: string) => (
    <button
      type="button"
      aria-pressed={editTab === tab}
      onClick={() => setEditTab(tab)}
      className={`museum-sans flex-1 rounded-sm py-2 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)] sm:text-xs ${
        editTab === tab
          ? "bg-[var(--museum-ink-soft)] text-[var(--museum-paper)]"
          : "bg-transparent text-[var(--museum-ink)]"
      }`}
    >
      {label}
    </button>
  );

  const modal =
    previewItem !== null ? (
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-3 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-label="Asset preview"
      >
        <div className="flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col rounded-sm border border-[var(--museum-rule)] bg-[var(--museum-parchment)] shadow-lg">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <p className="museum-serif text-sm text-[var(--museum-ink)]">
              {previewItem.label}
            </p>
            {previewItem.kind === "glb" ? (
              <>
                <div className="mt-3">
                  <GlbPreview url={viewerModelSrc(previewItem.src)} />
                </div>
                <label className="mt-4 block text-[10px] uppercase tracking-[0.16em] text-[var(--museum-muted)]">
                  Place on perch
                </label>
                <select
                  className="museum-sans mt-1 w-full rounded-sm border border-[var(--museum-rule)] bg-transparent px-2 py-2 text-xs outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)]"
                  value={placeSlotId}
                  onChange={(e) => setPlaceSlotId(e.target.value)}
                  disabled={registry.slots.length === 0}
                >
                  {registry.slots.length === 0 ? (
                    <option value="">No slots yet</option>
                  ) : (
                    registry.slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} ({s.id})
                      </option>
                    ))
                  )}
                </select>
              </>
            ) : (
              <div className="mt-3 overflow-hidden rounded-sm border border-[var(--museum-rule)] bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewItem.src}
                  alt=""
                  className="mx-auto max-h-[min(50vh,20rem)] w-full object-contain"
                />
              </div>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-wrap gap-2 border-t border-[var(--museum-rule)] p-3">
            <button
              type="button"
              onClick={onModalDelete}
              className="museum-sans min-h-10 flex-1 rounded-sm border border-[var(--museum-rule)] px-3 text-xs font-semibold text-[var(--museum-ink)] hover:bg-black/[0.04]"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setPreviewItem(null)}
              className="museum-sans min-h-10 flex-1 rounded-sm border border-[var(--museum-rule)] px-3 text-xs font-semibold text-[var(--museum-ink)] hover:bg-black/[0.04]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onModalPlace}
              disabled={
                previewItem.kind === "glb" && registry.slots.length === 0
              }
              className="museum-btn-primary museum-sans min-h-10 flex-[1.2] rounded-sm px-3 text-xs font-semibold disabled:opacity-45"
            >
              Place
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="museum-sans flex h-full min-h-0 flex-col text-[var(--museum-ink)]">
      {modal}
      <header className="flex-shrink-0 px-4 pb-2 pt-3">
        <h2 className="museum-serif text-base sm:text-lg">Staging room</h2>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--museum-muted)] sm:text-[11px]">
          Models from <Link href="/generate" className="underline decoration-[var(--museum-brass-dark)]">Generate</Link>, uploads, and perches · hang likeness on plaster.
        </p>
      </header>

      <div className="flex flex-shrink-0 gap-0.5 px-3">
        {tabBtn("model", "3D model")}
        {tabBtn("picture", "Picture")}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
        {editTab === "model" ? (
          <section aria-label="Three-dimensional assets" className="space-y-4">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--museum-muted)]">
                Your models
              </h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--museum-muted)]">
                Meshes created on{" "}
                <Link
                  href="/generate"
                  className="font-medium text-[var(--museum-brass-dark)] underline"
                >
                  Generate model
                </Link>{" "}
                show here. You can also add a local file below.
              </p>
              <ul className="mt-2 space-y-2">
                {modelsLibrary.length === 0 ? (
                  <li className="text-[11px] text-[var(--museum-muted)]">
                    None yet — open{" "}
                    <Link
                      href="/generate"
                      className="text-[var(--museum-brass-dark)] underline"
                    >
                      Generate model
                    </Link>{" "}
                    or upload a .glb below.
                  </li>
                ) : (
                  modelsLibrary.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        className="w-full rounded-sm border border-[var(--museum-rule)] bg-transparent px-2 py-2 text-left text-xs text-[var(--museum-ink)] transition hover:bg-black/[0.03]"
                        onClick={() => setPreviewItem(it)}
                      >
                        {it.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--museum-muted)]">
                Upload GLB
              </h3>
              <label className="museum-sans mt-2 inline-flex cursor-pointer flex-wrap items-center gap-1 text-[11px] text-[var(--museum-muted)]">
                <input
                  type="file"
                  accept=".glb,model/gltf-binary"
                  className="sr-only"
                  onChange={(e) => void onUploadGlb(e)}
                />
                <span className="text-[var(--museum-brass-dark)] underline">
                  Choose file
                </span>
                <span>.glb stored in this browser</span>
              </label>
            </div>
          </section>
        ) : (
          <section aria-label="Pictures" className="space-y-4">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--museum-muted)]">
                Upload picture
              </h3>
              <input
                type="file"
                accept="image/png,image/jpeg,.jpg,.jpeg,.png"
                className="museum-sans mt-2 block w-full text-[11px] file:mr-2 file:rounded-sm file:border file:border-[var(--museum-rule)] file:bg-transparent file:px-2 file:py-1"
                onChange={(e) => void onUploadPicture(e)}
              />
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--museum-muted)]">
                Your pictures
              </h3>
              <ul className="mt-2 space-y-2">
                {imagesLibrary.length === 0 ? (
                  <li className="text-[11px] text-[var(--museum-muted)]">
                    None yet — upload a JPG or PNG.
                  </li>
                ) : (
                  imagesLibrary.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        className="w-full rounded-sm border border-[var(--museum-rule)] bg-transparent px-2 py-2 text-left text-xs text-[var(--museum-ink)] transition hover:bg-black/[0.03]"
                        onClick={() => setPreviewItem(it)}
                      >
                        {it.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function EditHomeClient() {
  return (
    <HouseExperience siteMode="edit" placementPanel={(c) => <EditPanel {...c} />} />
  );
}
