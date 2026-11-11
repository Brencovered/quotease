import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept your team invite - SwiftScope",
  alternates: { canonical: "https://swiftscope.com.au/team/accept" },
  robots: { index: false, follow: true },
};

export default function TeamAcceptLayout({ children }: { children: React.ReactNode }) {
  return children;
}
