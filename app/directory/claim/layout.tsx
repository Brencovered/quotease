import type { Metadata } from "next";

// noindex,follow rather than a robots.txt Disallow. Claim links are
// already on listing pages, so Google has the URLs. A Disallow stops the
// crawl before this tag can be seen, and the URL can stay indexed as
// blocked. The canonical is the param-free claim URL: ?name=&suburb=&trade=
// is the same form, not a second page.
export const metadata: Metadata = {
  title: "Claim your directory listing - SwiftScope",
  description: "Claim your free SwiftScope directory listing and keep your business details up to date.",
  alternates: { canonical: "https://swiftscope.com.au/directory/claim" },
  robots: { index: false, follow: true },
};

export default function ClaimDirectoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
