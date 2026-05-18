export type MeshyTab = "text" | "image";

export type MeshyPollableTask = {
  id: string;
  status?: string;
  progress?: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
};

export async function meshyPollTask(path: string): Promise<MeshyPollableTask> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`status ${res.status}`);
  }
  return (await res.json()) as MeshyPollableTask;
}

export type PollMeshyOptions = {
  signal?: AbortSignal;
  onProgress?: (line: string) => void;
  /** Max iterations (default 540 * ~4.2s) */
  maxIterations?: number;
  delayMs?: number;
};

/**
 * Poll until SUCCEEDED (returns glb URL string), FAILED, aborted, or timeout.
 */
export async function pollMeshyUntilDone(
  kind: MeshyTab,
  id: string,
  options: PollMeshyOptions = {},
): Promise<{ ok: true; glbUrl: string } | { ok: false; message: string }> {
  const {
    signal,
    onProgress,
    maxIterations = 540,
    delayMs = 4200,
  } = options;

  const pathPrefix =
    kind === "text"
      ? `/api/meshy/v2/text-to-3d/`
      : `/api/meshy/v1/image-to-3d/`;

  for (let n = 0; n < maxIterations; n++) {
    if (signal?.aborted) {
      return { ok: false, message: "aborted" };
    }
    const data = await meshyPollTask(
      `${pathPrefix}${encodeURIComponent(id)}`,
    );
    onProgress?.(`${data.status ?? "?"} · ${data.progress ?? 0}%`);

    const st = (data.status || "").toUpperCase();
    if (st === "SUCCEEDED") {
      const remote = data.model_urls?.glb ?? null;
      if (remote) return { ok: true, glbUrl: remote };
      return { ok: false, message: "missing_glb_url" };
    }
    if (st === "FAILED") {
      return {
        ok: false,
        message: data.task_error?.message || "generation_failed",
      };
    }

    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ok: false, message: "timed_out_waiting" };
}

export async function meshyStartTextPreview(body: {
  prompt: string;
}): Promise<{ ok: true; taskId: string } | { ok: false; message: string }> {
  const previewRes = await fetch("/api/meshy/v2/text-to-3d", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "preview",
      prompt: body.prompt,
      target_formats: ["glb"],
      ai_model: "latest",
      should_remesh: false,
    }),
  });
  const previewJson = await previewRes.json();

  if (!previewRes.ok) {
    return { ok: false, message: JSON.stringify(previewJson) };
  }

  const previewTaskId =
    typeof previewJson === "object" && previewJson && "result" in previewJson
      ? String((previewJson as { result: unknown }).result)
      : null;

  if (!previewTaskId) {
    return { ok: false, message: "unexpected_meshy_preview_response" };
  }

  return { ok: true, taskId: previewTaskId };
}

export async function meshyStartTextRefine(previewTaskId: string): Promise<
  { ok: true; taskId: string } | { ok: false; message: string }
> {
  const refineRes = await fetch("/api/meshy/v2/text-to-3d", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "refine",
      preview_task_id: previewTaskId,
      target_formats: ["glb"],
      ai_model: "latest",
    }),
  });

  const refineJson = await refineRes.json();

  if (!refineRes.ok) {
    return { ok: false, message: `refine_issue ${JSON.stringify(refineJson)}` };
  }

  const refineId =
    typeof refineJson === "object" && refineJson && "result" in refineJson
      ? String((refineJson as { result: unknown }).result)
      : null;

  if (!refineId) {
    return { ok: false, message: "unexpected_meshy_refine_response" };
  }

  return { ok: true, taskId: refineId };
}

export async function meshyStartImageTo3d(imageDataUrl: string): Promise<
  { ok: true; taskId: string } | { ok: false; message: string }
> {
  const res = await fetch("/api/meshy/v1/image-to-3d", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageDataUrl,
      target_formats: ["glb"],
      ai_model: "latest",
      should_texture: true,
    }),
  });

  const j = await res.json();
  if (!res.ok) {
    return { ok: false, message: JSON.stringify(j) };
  }

  const id =
    typeof j === "object" && j && "result" in j
      ? String((j as { result: unknown }).result)
      : null;
  if (!id) {
    return { ok: false, message: "unexpected_meshy_image_response" };
  }

  return { ok: true, taskId: id };
}
