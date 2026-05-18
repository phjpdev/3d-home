/** Resolve a Meshy HTTPS URL for same-origin drei loading via our proxy. */
export function viewerModelSrc(rawUrl: string): string {
  const raw = rawUrl.trim().replace(/^['"]+|['"]+$/g, "");
  if (raw.startsWith("blob:") || raw.startsWith("data:") || raw.startsWith("/")) {
    return raw;
  }
  try {
    const url = new URL(raw);
    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      (url.hostname.endsWith(".meshy.ai") || url.hostname === "meshy.ai")
    ) {
      return `/api/models/proxy?u=${encodeURIComponent(url.toString())}`;
    }
    return raw;
  } catch {
    return `/api/models/proxy?u=${encodeURIComponent(raw)}`;
  }
}
