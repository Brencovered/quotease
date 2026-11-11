import type { Metadata } from "next";

// Customer quote links are private. noindex keeps a token URL out of
// search. There is no one canonical shared by every token.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function PublicQuoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
