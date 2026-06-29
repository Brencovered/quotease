import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

export async function GET(req: NextRequest) {
  const ref     = req.nextUrl.searchParams.get("ref");
  const maxw    = req.nextUrl.searchParams.get("maxw") ?? "400";
  if (!ref) return NextResponse.json({ error: "No ref" }, { status: 400 });

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxw}&photo_reference=${ref}&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  const blob    = await res.blob();
  const headers = new Headers();
  headers.set("Content-Type", res.headers.get("Content-Type") ?? "image/jpeg");
  headers.set("Cache-Control", "public, max-age=86400");
  return new NextResponse(blob, { headers });
}
