import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get quotes from local tradies - SwiftScope",
  description:
    "Tell us about your job and get quotes from verified local electricians, plumbers, carpenters and more - fast and free.",
  alternates: { canonical: "https://swiftscope.com.au/get-quotes" },
  robots: { index: false, follow: true },
};

export default function GetQuotesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
