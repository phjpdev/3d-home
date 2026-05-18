"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamicImport from "next/dynamic";

import {
  appendGeneratedGlbToEditLibrary,
} from "@/lib/assetLibrary";
import {
  meshyStartImageTo3d,
  meshyStartTextPreview,
  meshyStartTextRefine,
  pollMeshyUntilDone,
} from "@/lib/meshyClient";
import { viewerModelSrc } from "@/lib/modelUrl";

const GlbPreview = dynamicImport(() => import("@/components/GlbPreview"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-sm border border-[var(--museum-rule)] bg-[#1a1816]/80 text-[11px] text-white/65">
      Mounting reviewer…
    </div>
  ),
});

type Tab = "text" | "image";

export default function GenerateClient() {
  const [tab, setTab] = useState<Tab>("text");

  const [prompt, setPrompt] = useState("");
  const [textureAfterPreview, setTextureAfterPreview] = useState(false);

  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);

  const pollAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => pollAbort.current?.abort();
  }, []);

  const shortPromptLabel = (p: string) =>
    p.length > 42 ? `${p.slice(0, 40)}…` : p;

  const onTextGenerate = async () => {
    setBusy(true);
    setLog(null);
    setGlbUrl(null);
    pollAbort.current?.abort();
    pollAbort.current = new AbortController();
    const signal = pollAbort.current.signal;
    try {
      const p = prompt.slice(0, 600);
      if (!p.trim()) {
        setLog("prompt_required");
        return;
      }
      const start = await meshyStartTextPreview({ prompt: p });
      if (!start.ok) {
        setLog(start.message);
        return;
      }

      const previewPoll = await pollMeshyUntilDone("text", start.taskId, {
        signal,
        onProgress: setLog,
      });
      if (!previewPoll.ok) {
        setLog(previewPoll.message);
        return;
      }

      setGlbUrl(previewPoll.glbUrl);
      if (signal.aborted) return;

      if (!textureAfterPreview) {
        appendGeneratedGlbToEditLibrary(
          previewPoll.glbUrl,
          `Meshy · ${shortPromptLabel(p)}`,
        );
        return;
      }

      const refine = await meshyStartTextRefine(start.taskId);
      if (!refine.ok) {
        setLog(refine.message);
        return;
      }

      setGlbUrl(null);
      const refinePoll = await pollMeshyUntilDone("text", refine.taskId, {
        signal,
        onProgress: setLog,
      });
      if (!refinePoll.ok) {
        setLog(refinePoll.message);
        return;
      }
      setGlbUrl(refinePoll.glbUrl);
      appendGeneratedGlbToEditLibrary(
        refinePoll.glbUrl,
        `Meshy · ${shortPromptLabel(p)}`,
      );
    } catch (e) {
      setLog(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read_failed"));
      r.readAsDataURL(file);
    });

  const onPickImageFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setLog(null);
    setGlbUrl(null);
    pollAbort.current?.abort();
    pollAbort.current = new AbortController();
    const signal = pollAbort.current.signal;
    try {
      const uri = await fileToDataUrl(file);
      const start = await meshyStartImageTo3d(uri);
      if (!start.ok) {
        setLog(start.message);
        return;
      }

      const poll = await pollMeshyUntilDone("image", start.taskId, {
        signal,
        onProgress: setLog,
      });
      if (!poll.ok) {
        setLog(poll.message);
        return;
      }
      setGlbUrl(poll.glbUrl);
      appendGeneratedGlbToEditLibrary(poll.glbUrl, `Meshy · ${file.name}`);
    } catch (e) {
      setLog(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  };

  const downloadable =
    glbUrl && glbUrl.length > 0 ? viewerModelSrc(glbUrl) : null;

  const copyPasteField = () => (
    <>
      <label className="mt-8 block museum-sans text-xs font-semibold uppercase tracking-[0.2em] text-[var(--museum-muted)]">
        GLB link
      </label>
      <input
        readOnly
        className="museum-sans mt-2 block w-full rounded-sm border border-[var(--museum-rule)] bg-black/[0.02] px-3 py-2 text-xs text-[var(--museum-muted)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)]"
        value={glbUrl ?? ""}
        placeholder="Generated link appears here"
      />
      <p className="museum-sans mt-2 text-xs text-[var(--museum-muted)]">
        Saved to <Link href="/edit">Edit home</Link> under Your models automatically;
        copy the link if you need it elsewhere.
      </p>
    </>
  );

  const handleTextureToggle = useCallback(() => {
    setTextureAfterPreview((v) => !v);
  }, []);

  return (
    <div className="mx-auto max-w-xl flex-1 px-6 py-12 pb-28">
      <h1 className="museum-serif text-3xl text-[var(--museum-ink)]">
        Compose in clay
      </h1>
      <p className="museum-sans mt-4 text-[var(--museum-muted)]">
        Meshy works from your browser but keys stay on our server — we only relay
        shape and varnish.
      </p>

      <div className="mt-10 flex rounded-sm border border-[var(--museum-rule)] bg-[var(--museum-parchment)] p-1">
        <button
          type="button"
          aria-pressed={tab === "text"}
          onClick={() => setTab("text")}
          className={`museum-sans flex-1 rounded-sm py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)] ${
            tab === "text"
              ? "bg-[var(--museum-ink-soft)] text-[var(--museum-paper)]"
              : "bg-transparent text-[var(--museum-ink)]"
          }`}
        >
          From words
        </button>
        <button
          type="button"
          aria-pressed={tab === "image"}
          onClick={() => setTab("image")}
          className={`museum-sans flex-1 rounded-sm py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)] ${
            tab === "image"
              ? "bg-[var(--museum-ink-soft)] text-[var(--museum-paper)]"
              : "bg-transparent text-[var(--museum-ink)]"
          }`}
        >
          From sheet
        </button>
      </div>

      {tab === "text" ? (
        <>
          <label className="mt-8 block museum-sans text-xs font-semibold uppercase tracking-[0.2em] text-[var(--museum-muted)]">
            Prompt · 600 glyphs
          </label>
          <textarea
            className="museum-sans mt-2 block min-h-[7rem] w-full rounded-sm border border-[var(--museum-rule)] bg-transparent px-3 py-2 text-sm text-[var(--museum-ink)] outline-none placeholder:text-[var(--museum-muted)]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)]"
            value={prompt}
            maxLength={600}
            placeholder="Oak dining chair, restrained Bernese joinery …"
            onChange={(e) => setPrompt(e.target.value)}
          />
          <label className="museum-sans mt-4 flex cursor-pointer items-center gap-2 text-sm text-[var(--museum-ink)]">
            <input
              type="checkbox"
              checked={textureAfterPreview}
              onChange={handleTextureToggle}
            />
            Add colour pass after shape (second Meshy phase)
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onTextGenerate()}
            className="museum-btn-primary museum-sans mt-6 inline-flex min-h-11 rounded-sm px-8 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Requesting kiln…" : "Begin preview bake"}
          </button>
          {copyPasteField()}
        </>
      ) : (
        <>
          <label className="mt-8 block museum-sans text-xs font-semibold uppercase tracking-[0.2em] text-[var(--museum-muted)]">
            Sheet · JPG / PNG
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png"
            disabled={busy}
            className="museum-sans mt-3 block w-full text-sm file:mr-3 file:rounded-sm file:border file:border-[var(--museum-rule)] file:bg-transparent file:px-3 file:py-1.5"
            onChange={(e) => onPickImageFile(e.target.files?.[0] ?? null)}
          />
          {copyPasteField()}
        </>
      )}

      {log ? (
        <p className="museum-sans mt-6 whitespace-pre-wrap text-xs leading-relaxed text-[var(--museum-muted)]">
          {log}
        </p>
      ) : null}

      {glbUrl ? (
        <section className="mt-12 space-y-3">
          <GlbPreview url={glbUrl} />
          {downloadable ? (
            <a
              href={downloadable}
              download="meshy-export.glb"
              className="museum-btn-secondary museum-sans inline-flex min-h-10 items-center rounded-sm px-6 text-sm no-underline"
            >
              Save GLB snapshot
            </a>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
