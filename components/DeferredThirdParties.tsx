"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Vercel Analytics and Speed Insights inject <script> tags from an effect
 * that runs at hydration. Hydration usually finishes while fonts or images
 * are still in flight, so those scripts join the document's load group and
 * the tab spinner waits on them. Mounting only after window.load keeps
 * them off that critical path. The page is already painted by then.
 */
export default function DeferredThirdParties() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (document.readyState === "complete") {
      setReady(true);
      return;
    }
    const onLoad = () => setReady(true);
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  if (!ready) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
