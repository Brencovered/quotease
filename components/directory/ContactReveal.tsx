"use client";

import { useState } from "react";
import { Phone, Mail } from "lucide-react";

/**
 * ContactReveal
 * -------------
 * Shows a phone or email as a "tap to reveal" button rather than plain text
 * or a live tel:/mailto: link in the initial markup.
 *
 * Why this exists: every phone number on a public listing page was rendered
 * straight into the HTML inside an <a href="tel:..."> tag. A scraper never
 * has to execute JavaScript or click anything to read that -- it is sitting
 * in the response body on first load. Contact-scraping bots specifically
 * target tel: and mailto: links because they are structured and easy to
 * harvest at scale, unlike prose text.
 *
 * The value is NOT hidden from the page's initial server-rendered HTML in
 * this version -- it is a client component, so the value is still present
 * in the React payload/hydration data, just not as a clickable tel: link
 * until the visitor taps. This raises the bar against the simplest scrapers
 * (anything grepping for tel: or mailto: hrefs, or href attributes at all)
 * without needing a second network round trip. It is a deterrent, not a
 * guarantee: a scraper that parses the Next.js payload specifically could
 * still find it. True prevention would mean fetching the value from an API
 * only after the tap, which is a larger change and worth doing later if
 * scraping is still a problem after this.
 */
export default function ContactReveal({
  kind,
  value,
  className = "",
}: {
  kind: "phone" | "email";
  value: string;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const Icon = kind === "phone" ? Phone : Mail;
  const label = kind === "phone" ? "Show phone number" : "Show email";
  const href = kind === "phone" ? `tel:${value}` : `mailto:${value}`;

  if (revealed) {
    return (
      <a
        href={href}
        className={className}
        // rel=nofollow: this link only exists after a real tap, so there is
        // no reason for it to pass any weight to a crawler that somehow
        // still reaches it.
        rel="nofollow"
      >
        <Icon size={15} /> {value}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className={className}
      aria-label={label}
    >
      <Icon size={15} /> {label}
    </button>
  );
}
