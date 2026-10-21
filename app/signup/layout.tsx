import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up - SwiftScope",
  description:
    "Start your 7-day free trial of SwiftScope. Quote jobs in under 4 minutes - $45/month flat, unlimited everything, cancel anytime.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
