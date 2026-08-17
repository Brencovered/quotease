import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import { TRADE_HUBS } from "@/lib/marketing/trade-hubs";

export const metadata: Metadata = {
  title: "Quoting software by trade - Swiftscope",
  description:
    "On-site quoting and job software for electricians, plumbers, carpenters, roofers, and every trade Swiftscope supports.",
};

export default function ForTradesIndexPage() {
  return (
    <main className="bg-[#f4f6f8] text-[#071018] min-h-screen">
      <MarketingNav transparent />

      <section className="relative min-h-[72svh] overflow-hidden bg-[#1a242c]">
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
              "linear-gradient(105deg, rgba(26,36,44,0.94) 0%, rgba(26,36,44,0.82) 45%, rgba(26,36,44,0.45) 100%)",
          }}
        />
        <div className="absolute inset-y-0 left-0 w-full max-w-[680px] bg-gradient-to-r from-[#1a242c] via-[#1a242c]/70 to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-[1280px] mx-auto px-5 sm:px-6 pt-28 pb-16 lg:pt-36 lg:pb-20 min-h-[72svh] flex flex-col justify-end">
          <div className="home-hero-copy max-w-[520px]">
            <p className="font-display text-[clamp(2rem,5vw,2.8rem)] tracking-wide text-white mb-2">
              SwiftScope
            </p>
            <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#ffb400] mb-5">
              For your trade
            </p>
            <h1 className="font-display text-[clamp(2.2rem,5vw,3.5rem)] tracking-wide leading-[1.02] text-white max-w-[14ch] mb-5">
              Your trade. Quotes from site.
            </h1>
            <p className="font-sans text-[17px] leading-[1.65] text-[#e8eef2] max-w-[42ch] mb-8">
              Pick your trade. See how on-site quoting, phone accept, and a simple job board fit the way you actually price work.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[#ffb400] text-[#1a242c] font-extrabold text-[15px] px-6 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors w-fit"
            >
              Try it free <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-5 sm:px-6 py-14 lg:py-20">
        <div className="mb-10 max-w-2xl">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] tracking-wide text-[#071018] mb-2">
            Choose your trade
          </h2>
          <p className="font-sans text-[16px] leading-[1.65] text-[#5a6a78]">
            Each page shows the jobs, quote fields, and workflow for that trade.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRADE_HUBS.map((hub) => (
            <li key={hub.key}>
              <Link
                href={`/for/${hub.slug}`}
                className="group flex flex-col h-full bg-white border border-[#e4e8ec] overflow-hidden hover:border-[#071018] transition-colors"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={hub.heroImage}
                    alt={hub.heroAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${hub.heroPos}`}
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="font-display text-[1.45rem] tracking-wide text-[#071018] mb-2 group-hover:text-[#b88400] transition-colors">
                    {hub.label}
                  </p>
                  <p className="font-sans text-[14.5px] leading-[1.55] text-[#3d4a55] flex-1">
                    {hub.headline}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 font-sans text-[13.5px] font-bold text-[#071018]">
                    See how it works <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
