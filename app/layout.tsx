import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource/anton";
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quotease — quoting software built by tradies, for tradies",
  description: "Quote the job before you've left the driveway.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}<Analytics /></body>
    </html>
  );
}
