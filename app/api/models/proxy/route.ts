import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const u = request.nextUrl.searchParams.get("u");
  if (!u) return NextResponse.json({ error: "missing_u" }, { status: 400 });

  let remote: URL;
  try {
    remote = new URL(u);
  } catch {
    return NextResponse.json({ error: "invalid_u" }, { status: 400 });
  }

  const hostOk =
    remote.protocol === "https:" &&
    (remote.hostname.endsWith(".meshy.ai") || remote.hostname === "meshy.ai");
  if (!hostOk) {
    return NextResponse.json({ error: "blocked_host" }, { status: 403 });
  }

  const upstream = await fetch(remote, { redirect: "follow", cache: "no-store" });
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "upstream_failed", status: upstream.status },
      { status: 502 },
    );
  }

  const buf = Buffer.from(await upstream.arrayBuffer());

  let contentType = upstream.headers.get("Content-Type");
  if (remote.pathname.toLowerCase().endsWith(".glb")) {
    contentType = "model/gltf-binary";
  }
  if (!contentType || contentType === "binary/octet-stream") {
    contentType = "application/octet-stream";
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
