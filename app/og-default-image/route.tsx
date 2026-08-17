import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Default social-share preview image, used whenever a page doesn't have
 * its own specific OG image (see lib/seo/meta.ts). Matches the live brand
 * mark: white S on mitti #1a242c (same as favicon / app icon).
 */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a242c",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: 28,
            background: "#1a242c",
            border: "3px solid rgba(255,255,255,0.18)",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 700, color: "#ffffff" }}>S</div>
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "white", letterSpacing: -1 }}>
          SWIFTSCOPE
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#b7c7d4", marginTop: 16 }}>
          Quote it. Send it. Win it on site.
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
