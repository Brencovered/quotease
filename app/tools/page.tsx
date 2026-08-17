import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import { toolsByAudience } from "@/lib/marketing/tools";

export const metadata: Metadata = {
  title: "Free tools for tradies and homeowners - Swiftscope",
  description:
    "Free charge-out, margin, quote PDF, vehicle cost, ballpark job cost, DIY material calculators, and a hire checklist. Built for Australian tradies and homeowners.",
};

export default function ToolsIndexPage() {
  const tradieTools = toolsByAudience("tradie");
  const homeownerTools = toolsByAudience("homeowner");

  return (
    <main className="bg-[#f4f6f8] text-[#071018] min-h-screen">
      <MarketingNav />

      <section className="bg-[#1a242c]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 pt-12 pb-14 lg:pt-16 lg:pb-20">
          <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#ffb400] mb-3">
            Free tools
          </p>
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.4rem)] tracking-wide leading-[1.02] text-white max-w-[14ch] mb-4">
            Useful before you sign up.
          </h1>
          <p className="font-sans text-[16px] leading-[1.65] text-[#c5d4e0] max-w-[48ch]">
            Calculators and checklists for tradies who price work, and homeowners who plan jobs. No login required.
          </p>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-5 sm:px-6 py-12 lg:py-16">
        <div className="mb-8">
          <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#b88400] mb-2">
            For tradies
          </p>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] tracking-wide text-[#071018]">
            Price the work properly
          </h2>
        </div>
        <ul className="grid md:grid-cols-2 gap-4 mb-16">
          {tradieTools.map((tool) => (
            <li key={tool.slug}>
              <Link
                href={tool.href}
                className="group flex h-full flex-col bg-white border border-[#e4e8ec] p-6 hover:border-[#071018] transition-colors"
              >
                <span className="font-display text-[1.45rem] tracking-wide text-[#071018] group-hover:text-[#b88400] transition-colors mb-2">
                  {tool.shortTitle}
                </span>
                <span className="font-sans text-[14.5px] leading-[1.6] text-[#3d4a55] flex-1">
                  {tool.description}
                </span>
                <span className="mt-5 inline-flex items-center gap-1.5 font-sans text-[13.5px] font-bold text-[#071018]">
                  Open tool <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mb-8">
          <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#b88400] mb-2">
            For homeowners
          </p>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] tracking-wide text-[#071018]">
            Plan the job. Then find a tradie.
          </h2>
        </div>
        <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {homeownerTools.map((tool) => (
            <li key={tool.slug}>
              <Link
                href={tool.href}
                className="group flex h-full flex-col bg-white border border-[#e4e8ec] p-6 hover:border-[#071018] transition-colors"
              >
                <span className="font-display text-[1.35rem] tracking-wide text-[#071018] group-hover:text-[#b88400] transition-colors mb-2">
                  {tool.shortTitle}
                </span>
                <span className="font-sans text-[14.5px] leading-[1.6] text-[#3d4a55] flex-1">
                  {tool.description}
                </span>
                <span className="mt-5 inline-flex items-center gap-1.5 font-sans text-[13.5px] font-bold text-[#071018]">
                  Open tool <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-[#1a242c]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 py-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <p className="font-display text-[1.7rem] tracking-wide text-white mb-2">
              Ready to quote from site?
            </p>
            <p className="font-sans text-[14.5px] text-white/55 max-w-[40ch]">
              Load your rates once. Mark up, price, and send before you leave the driveway.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#ffb400] text-[#1a242c] font-extrabold text-[15px] px-6 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors"
          >
            Start free trial <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  );
}
