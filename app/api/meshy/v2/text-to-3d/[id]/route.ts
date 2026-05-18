import { forwardMeshy } from "@/lib/meshyServer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const upstream = await forwardMeshy(
    `/openapi/v2/text-to-3d/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  const out = Buffer.from(await upstream.arrayBuffer());
  const ct =
    upstream.headers.get("Content-Type") || "application/json; charset=utf-8";

  return new Response(out, {
    status: upstream.status,
    headers: {
      "Content-Type": ct,
      "Cache-Control": "no-store",
    },
  });
}
