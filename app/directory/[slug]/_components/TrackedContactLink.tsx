"use client";

import { usePostHog } from "posthog-js/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

interface TrackedContactLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  event: "call_click" | "website_click";
  listingId: string;
  isClaimed: boolean;
  children: ReactNode;
}

/**
 * Fires a named PostHog event before navigating, for a link (Call,
 * Visit website) that would otherwise leave no trace of which
 * specific listing action someone took - autocapture's generic
 * $autocapture events exist, but matching them back to a specific
 * button by free-text el_text is fragile (text changes, styling
 * changes, autocapture doesn't reliably fire for every element type),
 * and doesn't carry listing-specific context. This carries listing_id
 * and is_claimed directly on the event so the funnel can actually be
 * sliced "by listing and claimed vs unclaimed" as intended, rather
 * than reconstructed after the fact from page URLs.
 *
 * The listing page's Call/Website links are server-rendered (the page
 * itself is an async Server Component) - this is the one small client
 * wrapper needed to attach an onClick handler to them without
 * converting the whole page to a client component. DirectoryCard is
 * already "use client" and calls usePostHog() directly instead, since
 * it's a single link with no other client wrapping needed there.
 */
export default function TrackedContactLink({ event, listingId, isClaimed, children, onClick, ...anchorProps }: TrackedContactLinkProps) {
  const posthogClient = usePostHog();

  return (
    <a
      {...anchorProps}
      onClick={(e) => {
        posthogClient?.capture(event, { listing_id: listingId, is_claimed: isClaimed });
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}
