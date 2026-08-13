import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import { TRADE_HUBS } from "@/lib/marketing/trade-hubs";

export const metadata: Metadata = {
  title: "Quoting software by trade - Swiftscope",
  description:
    "Trade-specific quoting and job software for electricians, plumbers, carpenters, roofers, and every trade Swiftscope supports.",
};

export default function ForTradesIndexPage() {
  return (
    <main className="bg-[#1a242c] text-white min-h-screen">
      <MarketingNav transparent />

      <section className="relative min-h-[70svh] overflow-hidden">
        <Image
          src="/trades/new-electrician.png"
          alt="Tradie on a residential site"
          fill
          priority
          sizes="100vw"
          quality={90}
          className="object-cover object-[30%_center]"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(26,36,44,0.92) 0%, rgba(26,36,44,0.78) 45%, rgba(26,36,44,0.4) 100%)",
          }}
        />
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 pt-28 pb-16 lg:pt-36 lg:pb-20 min-h-[70svh] flex flex-col justify-end">
          <p className="font-display text-[clamp(1.8rem,4vw,2.6rem)] tracking-wide text-white mb-3">
            SwiftScope
          </p>
          <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-4">
            For your trade
          </p>
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.5rem)] tracking-wide leading-[1.02] text-white max-w-[14ch] mb-4">
            Built the way your trade prices work.
          </h1>
          <p className="font-sans text-[16px] leading-[1.65] text-[#d5e0e8] max-w-[44ch] mb-8">
            Pick your trade. See how on-site quoting, client accept, and job management fit the way you actually work.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#ffb400] text-[#1a242c] font-extrabold text-[14.5px] px-6 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors w-fit"
          >
            Try it free <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-6 py-14 lg:py-16">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRADE_HUBS.map((hub) => (
            <li key={hub.key}>
              <Link
                href={`/for/${hub.slug}`}
                className="group relative block aspect-[5/4] overflow-hidden rounded-2xl"
              >
                <Image
                  src={hub.heroImage}
                  alt={hub.heroAlt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className={`object-cover transition-transform duration-500 group-hover:scale-[1.04] ${hub.heroPos}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a242c]/95 via-[#1a242c]/35 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="font-display text-[1.45rem] tracking-wide text-white mb-1 group-hover:text-[#ffb400] transition-colors">
                    {hub.label}
                  </p>
                  <p className="font-sans text-[13px] text-white/65 max-w-[32ch] line-clamp-2">
                    {hub.headline}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
