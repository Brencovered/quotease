import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Default social-share preview image, used whenever a page doesn't have
 * its own specific OG image (see lib/seo/meta.ts). The original plan was
 * a static /public/og-default.jpg, but that file was never actually
 * created -- the constant pointed at a path that 404s, so every page
 * relying on it (most marketing pages) had a broken preview image when
 * shared on social platforms, and no image for Google to use either.
 * Generated on request (and cached) rather than a hand-made static file,
 * so it stays in sync with the brand colours used everywhere else.
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
          background: "#0a1722",
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
            background: "#ffb400",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 900, color: "#0a1722" }}>S</div>
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "white", letterSpacing: -1 }}>
          SWIFTSCOPE
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#8aa4b4", marginTop: 16 }}>
          Quote it. Send it. Win it on site.
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
