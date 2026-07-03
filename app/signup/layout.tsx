import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up - Swiftscope",
  description:
    "Start your 3-day free trial of Swiftscope. Quote jobs in under 4 minutes -- $45/month flat, unlimited everything, cancel anytime.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
