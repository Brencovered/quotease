import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

export async function GET(req: NextRequest) {
  const ref     = req.nextUrl.searchParams.get("ref");
  const maxw    = req.nextUrl.searchParams.get("maxw") ?? "400";
  if (!ref) return NextResponse.json({ error: "No ref" }, { status: 400 });

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxw}&photo_reference=${ref}&key=${API_KEY}`;

  // Without a timeout, a slow/hanging upstream response leaves this function
  // (and the <img> waiting on it in the browser) hung indefinitely rather
  // than failing cleanly, which is exactly what a client-side onError
  // fallback needs to be able to react to.
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
    const errText = await res.text().catch(() => "");
    console.error(`[places/photo] Google returned ${res.status} for ref starting "${ref.slice(0, 12)}...": ${errText.slice(0, 300)}`);
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const blob    = await res.blob();
  const headers = new Headers();
  headers.set("Content-Type", res.headers.get("Content-Type") ?? "image/jpeg");
  headers.set("Cache-Control", "public, max-age=86400");
  return new NextResponse(blob, { headers });
}
