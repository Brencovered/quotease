"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f6f8", padding: "24px" }}>
          <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.4rem", color: "#0a1722", marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#5a6a78", marginBottom: 24, lineHeight: 1.5 }}>
              That&apos;s on us, not you. Try reloading the page.
            </p>
            <button
              onClick={() => reset()}
              style={{ background: "#0a1722", color: "#ffb400", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Try again
            </button>
            {error.digest && (
              <p style={{ fontSize: 11, color: "#8aa4b4", marginTop: 20 }}>Error reference: {error.digest}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
