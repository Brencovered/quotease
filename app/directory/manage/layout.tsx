import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manage your directory listing - SwiftScope",
  description: "Update the public SwiftScope directory listing for your business.",
  alternates: { canonical: "https://swiftscope.com.au/directory/manage" },
  robots: { index: false, follow: true },
};

export default function ManageDirectoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
