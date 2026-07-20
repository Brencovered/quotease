"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";

/**
 * The sidebar business logo, with a graceful fallback if `logoUrl` 404s or
 * otherwise fails to load. Scraped logo URLs (favicons, og:image, etc.)
 * aren't guaranteed to stay valid forever -- a site redesign, a dead
 * domain, or a bad scrape can all leave a stale/broken URL on file. Without
 * this, a broken <img> just shows the browser's broken-image icon next to
 * the raw alt text, which is what showed up in production.
 *
 * http:// URLs are treated as invalid up front, never even attempted --
 * an http:// image on this https:// page is mixed content, and browsers
 * handle that inconsistently (onError doesn't reliably fire the way it
 * does for a normal failed load), so these were showing up as
 * permanently broken instead of falling back cleanly. The scraper now
 * upgrades these to https:// at the source, but this is a second line of
 * defence for anything that slips through.
 */
export default function ListingLogo({
  logoUrl,
  businessName,
  accent,
}: {
  logoUrl: string | null;
  businessName: string;
  accent: string;
}) {
  const [failed, setFailed] = useState(false);
  const isInsecure = logoUrl?.startsWith("http://") ?? false;

  if (!logoUrl || failed || isInsecure) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl mx-auto mb-1 flex items-center justify-center" style={{ background: accent }}>
          <Wrench size={20} className="text-white" />
        </div>
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Swiftscope</p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={businessName}
      className="max-h-20 max-w-[80%] object-contain"
      onError={() => setFailed(true)}
    />
  );
}
