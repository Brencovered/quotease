import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";

export const metadata: Metadata = {
  title: "Free tools for tradies - Swiftscope",
  description:
    "Free calculators and planning tools for Australian tradies. Start with the charge-out rate calculator, then quote on site with Swiftscope.",
};

const TOOLS = [
  {
    href: "/tools/charge-out-rate",
    title: "Charge-out rate calculator",
    body: "Work out an hourly and day rate from the take-home you need, real overhead, and the days you actually bill.",
  },
];

export default function ToolsIndexPage() {
  return (
    <main className="bg-[#1a242c] text-white min-h-screen">
      <MarketingNav />
      <section className="max-w-[1280px] mx-auto px-6 pt-14 pb-20">
        <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
          Free tools
        </p>
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.4rem)] tracking-wide leading-[1.02] text-white max-w-[14ch] mb-4">
            Useful before you sign up.
          </h1>
          <p className="font-sans text-[16px] leading-[1.65] text-[#c5d4e0] max-w-[44ch] mb-12">
            Free planning tools for solo tradies and small crews. No login. Then load the numbers into your Swiftscope book and quote from site.
          </p>
        <ul className="max-w-2xl space-y-1">
          {TOOLS.map((tool) => (
            <li key={tool.href} className="border-b border-white/10">
              <Link
                href={tool.href}
                className="group flex items-start justify-between gap-6 py-6"
              >
                <span>
                  <span className="block font-display text-[1.45rem] tracking-wide text-white group-hover:text-[#ffb400] transition-colors">
                    {tool.title}
                  </span>
                  <span className="block font-sans text-[14.5px] text-white/50 mt-2 max-w-[42ch]">
                    {tool.body}
                  </span>
                </span>
                <ArrowRight
                  size={16}
                  className="mt-2 shrink-0 text-white/30 group-hover:text-[#ffb400] transition-colors"
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
