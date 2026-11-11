import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in - SwiftScope",
  description:
    "Log in to your SwiftScope account to send quotes, manage jobs, and grow your tradie business.",
  alternates: { canonical: "https://swiftscope.com.au/login" },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
