"use client";

import { useEffect } from "react";

/**
 * Switches the document onto Inter and Anton only after window.load.
 *
 * Chrome holds window.onload until an in-use @font-face file finishes,
 * even with font-display: swap. The root layout therefore paints with
 * next/font's local() fallback faces. This effect adds `fonts-ready` once
 * load has fired so the woff2 request cannot sit in the load group.
 *
 * It has to be an effect rather than an inline script. The not-found
 * response is Next's `__next_error__` shell; the real layout is applied
 * on the client, and scripts React inserts do not run. An effect also
 * runs after hydration, so it does not change `<html class>` out from
 * under the server markup.
 */
export default function BrandFonts() {
  useEffect(() => {
    const enable = () => document.documentElement.classList.add("fonts-ready");
    if (document.readyState === "complete") enable();
    else window.addEventListener("load", enable, { once: true });
    return () => window.removeEventListener("load", enable);
  }, []);
  return null;
}
