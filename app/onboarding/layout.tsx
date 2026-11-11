import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set up your account - SwiftScope",
  alternates: { canonical: "https://swiftscope.com.au/onboarding" },
  robots: { index: false, follow: true },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
