import { forwardMeshy } from "@/lib/meshyServer";

export async function POST(request: Request) {
  let bodyRaw: string;
  try {
    bodyRaw = await request.text();
  } catch {
    return new Response(JSON.stringify({ error: "bad_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const parsed = JSON.parse(bodyRaw);
    void parsed;
  } catch {
    return new Response(JSON.stringify({ error: "expected_json_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await forwardMeshy("/openapi/v1/image-to-3d", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyRaw,
  });

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
