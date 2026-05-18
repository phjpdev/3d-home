const MESHY_API = "https://api.meshy.ai";

export function getMeshyApiKey(): string | null {
  const key = process.env.MESHY_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export async function forwardMeshy(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const key = getMeshyApiKey();
  if (!key) {
    return new Response(JSON.stringify({ error: "meshy_missing_api_key" }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const mergedHeaders = new Headers(init?.headers ?? undefined);
  mergedHeaders.set("Authorization", `Bearer ${key}`);
  if (!mergedHeaders.has("Accept"))
    mergedHeaders.set("Accept", "application/json");

  return fetch(`${MESHY_API}${path}`, {
    ...init,
    headers: mergedHeaders,
    cache: "no-store",
  });
}
