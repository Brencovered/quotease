"use client";

import { useState } from "react";

/**
 * A plain <img> with a broken src just shows the browser's native
 * broken-image glyph next to the raw alt text -- this hides itself
 * entirely on error instead. Use anywhere a logo_url might be stale
 * (scraped from a site that's since changed, or any user-uploaded image
 * URL that could 404).
 *
 * http:// URLs are treated as invalid up front, never even attempted --
 * mixed content on an https:// page doesn't reliably trigger onError the
 * way a normal failed load does, so these were showing up as permanently
 * broken rather than falling back cleanly.
 */
export default function SafeLogoImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || src.startsWith("http://")) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}
