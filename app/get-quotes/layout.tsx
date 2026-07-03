import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get quotes from local tradies - Swiftscope",
  description:
    "Tell us about your job and get quotes from verified local electricians, plumbers, carpenters and more -- fast and free.",
};

export default function GetQuotesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
