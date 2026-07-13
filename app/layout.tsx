import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Archivo, Anton } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import OrganizationSchema from "@/components/seo/OrganizationSchema";

// Previously loaded via @fontsource imports (5 separate self-hosted font
// files pulled in as global CSS) - Lighthouse's network dependency tree
// showed these chained one after another on the critical path, reaching
// 453-612ms before text could render in its final font. next/font/google
// self-hosts the same files (still no runtime Google Fonts request) but
// generates its own preload links and font-display: swap automatically,
// which is the documented fix for exactly this render-blocking-font-chain
// pattern rather than something to hand-roll with manual preload tags.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--font-archivo",
});
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-anton",
});

export const metadata: Metadata = {
  title: "Swiftscope - quote it, send it, win the job",
  description: "Quote the job before you've left the driveway.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: [
      { url: "/api/favicon?size=180", sizes: "180x180" },
    ],
    other: [
      { rel: "manifest", url: "/site.webmanifest" },
    ],
  },
  themeColor: "#1c252d",
  appleWebApp: {
    title: "Swiftscope",
    statusBarStyle: "black-translucent",
  },
  manifest: "/site.webmanifest",
};

const GA_ID = "G-GVM9GY952S";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${archivo.variable} ${anton.variable}`}>
      <head>
        <link rel="mask-icon" href="/favicon.svg" color="#1c252d" />
        <meta name="msapplication-TileColor" content="#1c252d" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <OrganizationSchema />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
        {/* Google Analytics */}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}</Script>
      </body>
    </html>
  );
}
