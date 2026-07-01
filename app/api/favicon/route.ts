import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const SVG_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#1c252d" rx="12"/>
  <text x="50" y="62" font-family="Arial Black, Impact, sans-serif" font-size="32" font-weight="900" fill="white" text-anchor="middle" letter-spacing="-1">S</text>
</svg>`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const size = parseInt(searchParams.get("size") || "32", 10);
  const validSizes = [16, 32, 48, 150, 180, 192, 512];
  const targetSize = validSizes.includes(size) ? size : 32;

  try {
    const pngBuffer = await sharp(Buffer.from(SVG_FAVICON))
      .resize(targetSize, targetSize)
      .png()
      .toBuffer();

    return new NextResponse(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Failed to generate favicon", { status: 500 });
  }
}
