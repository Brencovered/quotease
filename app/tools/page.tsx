import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import { ToolDisclaimer } from "@/components/marketing/tools/ToolShell";
import { toolsByAudience } from "@/lib/marketing/tools";

function AccessBadge({ label }: { label: string }) {
  const fullyFree = label.startsWith("No login");
  return (
    <span
      className={[
        "inline-flex self-start mb-2 text-[11px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded",
        fullyFree ? "text-[#1c7a3a] bg-[#e8f5ec]" : "text-[#8a5a00] bg-[#fff6db]",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

export const metadata: Metadata = {
  title: "Free tradie calculators and homeowner tools - Swiftscope",
  description:
    "Free Australian tradie tools: true charge-out rate with super and unbillable time, margin vs markup converter, quote PDF generator, and vehicle cost calculator. Plus homeowner ballpark and DIY tools. Guidelines only, not financial advice.",
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
          <p className="font-sans text-[16px] leading-[1.65] text-[#c5d4e0] max-w-[48ch] mb-5">
            Calculators and checklists for tradies who price work, and homeowners who plan jobs. Use every tool in the browser with no account.
          </p>
          <p className="font-sans text-[13.5px] leading-[1.6] text-white/70 max-w-[52ch] mb-5">
            Saving rates, sending a real quote, or exporting a PDF with your details needs a free trial. Playing with the numbers does not.
          </p>
          <p className="font-sans text-[13px] leading-[1.6] text-white/55 max-w-[52ch] border-l-2 border-[#ffb400]/70 pl-4">
            Planning guidelines only. Not financial, tax, or legal advice.
          </p>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-5 sm:px-6 pt-8">
        <ToolDisclaimer />
      </section>

      <section className="max-w-[1280px] mx-auto px-5 sm:px-6 py-10 lg:py-14">
        <div className="mb-8">
          <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#b88400] mb-2">
            For tradies
          </p>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] tracking-wide text-[#071018]">
            Solve the pricing headaches
          </h2>
          <p className="font-sans text-[15px] text-[#5a6a78] mt-2 max-w-[48ch]">
            Built around Australian costs: super, unbillable time, GST, and ATO vehicle rates. Always verify with official sources.
          </p>
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
                <AccessBadge label={tool.accessLabel} />
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
          <p className="font-sans text-[15px] text-[#5a6a78] mt-2 max-w-[48ch]">
            Ballpark Australian job costs, or work out concrete, paint, and tile quantities before you DIY.
          </p>
        </div>
        <ul className="grid md:grid-cols-2 gap-4">
          {homeownerTools.map((tool) => (
            <li key={tool.slug}>
              <Link
                href={tool.href}
                className="group flex h-full flex-col bg-white border border-[#e4e8ec] p-6 hover:border-[#071018] transition-colors"
              >
                <span className="font-display text-[1.35rem] tracking-wide text-[#071018] group-hover:text-[#b88400] transition-colors mb-2">
                  {tool.shortTitle}
                </span>
                <AccessBadge label={tool.accessLabel} />
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
            className="inline-flex items-center gap-2 bg-[#ffb400] text-[#1a242c] font-sans font-extrabold text-[15px] px-6 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors"
          >
            Start free trial <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  );
}
