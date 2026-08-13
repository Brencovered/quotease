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
    <main className="bg-[#050b11] text-white min-h-screen">
      <MarketingNav />

      <section className="relative overflow-hidden border-b border-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(255,180,0,0.14), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 20%, rgba(56,120,180,0.18), transparent 50%)",
          }}
        />
        <div className="relative max-w-[1280px] mx-auto px-6 pt-14 pb-16">
          <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
            For your trade
          </p>
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] tracking-wide leading-[1.02] text-white max-w-[16ch] mb-4">
            Built the way your trade prices work.
          </h1>
          <p className="font-sans text-[16px] leading-[1.65] text-[#c5d4e0] max-w-[46ch] mb-8">
            Pick your trade. See how on-site quoting, client accept, and job management fit the way you actually work.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14.5px] px-6 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors"
          >
            Try it free <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-6 py-14">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
          {TRADE_HUBS.map((hub) => (
            <li key={hub.key} className="border-b border-white/10">
              <Link
                href={`/for/${hub.slug}`}
                className="group flex items-center justify-between gap-4 py-5 text-white/85 hover:text-white transition-colors"
              >
                <span>
                  <span className="block font-display text-[1.35rem] tracking-wide text-white group-hover:text-[#ffb400] transition-colors">
                    {hub.label}
                  </span>
                  <span className="block font-sans text-[13.5px] text-white/45 mt-1 max-w-[36ch]">
                    {hub.metaTitle}
                  </span>
                </span>
                <ArrowRight
                  size={16}
                  className="shrink-0 text-white/30 group-hover:text-[#ffb400] transition-colors"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
