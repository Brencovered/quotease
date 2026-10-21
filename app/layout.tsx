import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Anton } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { PostHogProvider } from "@/components/PostHogProvider";
import DeferredThirdParties from "@/components/DeferredThirdParties";
import BrandFonts from "@/components/BrandFonts";
import OrganizationSchema from "@/components/seo/OrganizationSchema";
import { WebSiteSchema } from "@/components/seo/StructuredData";

// next/font/google self-hosts the files (no runtime Google Fonts request).
// preload is off so Next does not emit <link rel="preload" as="font">.
// The families are still not applied until html.fonts-ready, which
// BrandFonts adds from the load event. Chrome waits for an in-use
// @font-face download before firing window.load, including with
// font-display: swap, so a stalled woff2 otherwise holds the tab spinner
// after the page has already painted.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
  preload: false,
});
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-anton",
  preload: false,
});

export const metadata: Metadata = {
  title: "SwiftScope - quote it, send it, win the job",
  description: "Quote the job before you've left the driveway.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    other: [
      { rel: "manifest", url: "/site.webmanifest" },
    ],
  },
  appleWebApp: {
    title: "SwiftScope",
    statusBarStyle: "black-translucent",
  },
  manifest: "/site.webmanifest",
};

// themeColor lives here, not in `metadata`. Next moved the viewport-ish
// keys (themeColor, width, initialScale, colorScheme) to their own export;
// leaving themeColor in `metadata` is a no-op that logs a warning for
// every single page rendered. With ~2,900 prerendered SEO routes that was
// several hundred lines of build log from one line of source, which is
// exactly the kind of noise that hides a real failure.
export const viewport: Viewport = {
  themeColor: "#1a242c",
};

const GA_ID = "G-GVM9GY952S";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${anton.variable}`}>
      <head>
        <link rel="mask-icon" href="/favicon.svg" color="#1a242c" />
        <meta name="msapplication-TileColor" content="#1a242c" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <OrganizationSchema />
        <WebSiteSchema />
      </head>
      <body className="min-h-full flex flex-col">
        <PostHogProvider>
          <Providers>{children}</Providers>
        </PostHogProvider>
        <DeferredThirdParties />
        <BrandFonts />
        {/* Google Analytics. lazyOnload (no src) does not emit a
            <link rel="preload">, and it runs from requestIdleCallback,
            which is after window.load. Loading gtag from here — rather
            than next/script afterInteractive — keeps a slow or stalled
            googletagmanager request from holding the tab spinner. */}
        <Script id="google-analytics" strategy="lazyOnload">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
          });
          var s = document.createElement('script');
          s.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
          s.async = true;
          document.head.appendChild(s);
        `}</Script>
      </body>
    </html>
  );
}
