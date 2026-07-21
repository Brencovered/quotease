import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

export async function GET(req: NextRequest) {
  const ref  = req.nextUrl.searchParams.get("ref");
  const maxw = req.nextUrl.searchParams.get("maxw") ?? "400";

  if (!ref) return NextResponse.json({ error: "No ref" }, { status: 400 });

  // Only serve already-cached (http) URLs -- block live Google calls
  // This endpoint is now disabled until the bulk cache job clears the backlog
  // Remove this check once all photo_references are real URLs
  if (!ref.startsWith("http")) {
    return NextResponse.json({ error: "Not cached yet" }, { status: 404 });
  }

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxw}&photo_reference=${ref}&key=${API_KEY}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch {
    return NextResponse.json({ error: "Photo fetch timed out" }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const blob    = await res.blob();
  const headers = new Headers();
  headers.set("Content-Type", res.headers.get("Content-Type") ?? "image/jpeg");
  // s-maxage = Vercel Edge CDN cache, max-age = browser cache
  // This means the same ref only hits Google ONCE then is served from CDN
  headers.set("Cache-Control", "public, s-maxage=31536000, max-age=86400, stale-while-revalidate");
  return new NextResponse(blob, { headers });
}
