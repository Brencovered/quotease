import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import ChargeOutCalculator from "@/components/marketing/ChargeOutCalculator";

export const metadata: Metadata = {
  title: "Charge-out rate calculator for tradies - Swiftscope",
  description:
    "Free charge-out rate calculator for Australian tradies. Set take-home pay, overhead, and billable days to get an hourly and day rate.",
  alternates: { canonical: "https://swiftscope.com.au/tools/charge-out-rate" },
};

export default function ChargeOutRatePage() {
  return (
    <main className="bg-[#050b11] text-white min-h-screen">
      <MarketingNav />

      <section className="relative overflow-hidden border-b border-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 10% 0%, rgba(255,180,0,0.14), transparent 55%), radial-gradient(ellipse 40% 40% at 90% 20%, rgba(40,100,160,0.18), transparent 50%)",
          }}
        />
        <div className="relative max-w-[1280px] mx-auto px-6 pt-12 pb-10">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 font-sans text-[13px] font-semibold text-white/50 hover:text-white transition-colors mb-6"
          >
            All tools
          </Link>
          <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
            Free calculator
          </p>
          <h1 className="font-display text-[clamp(2.1rem,4.8vw,3.4rem)] tracking-wide leading-[1.02] text-white max-w-[16ch] mb-4">
            What should you charge out at?
          </h1>
          <p className="font-sans text-[16px] leading-[1.65] text-[#c5d4e0] max-w-[48ch]">
            Work backwards from the take-home you need, your real overhead, and how many hours you actually bill. Then put those rates into your Swiftscope price book.
          </p>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-6 py-12 lg:py-16">
        <ChargeOutCalculator />
      </section>

      <section className="border-t border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <p className="font-display text-[1.5rem] tracking-wide text-white mb-2">
              Next: quote with those rates on site
            </p>
            <p className="font-sans text-[14.5px] text-white/50 max-w-[40ch]">
              Load labour into your book once, then price jobs from your phone while you are still on site.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/for"
              className="inline-flex items-center gap-2 font-sans text-[14px] font-semibold text-white/70 hover:text-white transition-colors px-4 py-3"
            >
              See your trade <ArrowRight size={14} aria-hidden />
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-5 py-3 rounded-lg hover:bg-[#e89e00] transition-colors"
            >
              Try Swiftscope free <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
