import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in - Swiftscope",
  description:
    "Log in to your Swiftscope account to send quotes, manage jobs, and grow your tradie business.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
