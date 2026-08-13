import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import FaqSchema from "@/components/seo/FaqSchema";
import { TRADE_HUBS, getTradeHubBySlug } from "@/lib/marketing/trade-hubs";

type PageProps = {
  params: Promise<{ trade: string }>;
};

export function generateStaticParams() {
  return TRADE_HUBS.map((h) => ({ trade: h.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { trade } = await params;
  const hub = getTradeHubBySlug(trade);
  if (!hub) return { title: "For your trade - Swiftscope" };
  return {
    title: `${hub.metaTitle} - Swiftscope`,
    description: hub.metaDescription,
    alternates: { canonical: `https://swiftscope.com.au/for/${hub.slug}` },
  };
}

export default async function TradeHubPage({ params }: PageProps) {
  const { trade } = await params;
  const hub = getTradeHubBySlug(trade);
  if (!hub) notFound();

  const others = TRADE_HUBS.filter((h) => h.key !== hub.key);
  const signupHref = `/signup?trade=${encodeURIComponent(hub.key)}`;

  return (
    <main className="bg-[#050b11] text-white min-h-screen">
      <MarketingNav />
      <FaqSchema faqs={hub.faqs} />

      <section className="relative overflow-hidden border-b border-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 15% 10%, rgba(255,180,0,0.16), transparent 55%), radial-gradient(ellipse 45% 40% at 90% 30%, rgba(40,100,160,0.2), transparent 50%)",
          }}
        />
        <div className="relative max-w-[1280px] mx-auto px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
          <Link
            href="/for"
            className="inline-flex items-center gap-1.5 font-sans text-[13px] font-semibold text-white/50 hover:text-white transition-colors mb-6"
          >
            All trades
          </Link>
          <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
            For {hub.plural}
          </p>
          <h1 className="font-display text-[clamp(2.1rem,4.8vw,3.5rem)] tracking-wide leading-[1.02] text-white max-w-[18ch] mb-4">
            {hub.headline}
          </h1>
          <p className="font-sans text-[16px] leading-[1.65] text-[#c5d4e0] max-w-[48ch] mb-8">
            {hub.subhead}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={signupHref}
              className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14.5px] px-6 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors"
            >
              Try it free <ArrowRight size={15} aria-hidden />
            </Link>
            <Link
              href="/tools/charge-out-rate"
              className="inline-flex items-center gap-2 font-sans text-[14px] font-semibold text-white/60 hover:text-white transition-colors"
            >
              Free charge-out calculator <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-14 lg:py-16 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] tracking-wide leading-[1.08] text-white mb-4 max-w-[18ch]">
              The on-site problem
            </h2>
            <p className="font-sans text-[15.5px] leading-[1.7] text-[#c5d4e0] max-w-[42ch]">
              {hub.pain}
            </p>
          </div>
          <div className="lg:col-span-7">
            <ul className="space-y-4">
              {hub.outcomes.map((item) => (
                <li key={item} className="flex items-start gap-3 font-sans text-[15px] text-white/85">
                  <Check size={16} className="mt-1 shrink-0 text-[#ffb400]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#071018]">
        <div className="max-w-[1280px] mx-auto px-6 py-14 lg:py-16 grid md:grid-cols-2 gap-12">
          <div>
            <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
              Common jobs
            </p>
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] tracking-wide leading-[1.08] text-white mb-6">
              What {hub.plural} quote in Swiftscope
            </h2>
            <ul className="space-y-2.5">
              {hub.jobTypes.map((job) => (
                <li key={job} className="font-sans text-[15px] text-[#c5d4e0] border-b border-white/[0.08] py-2.5">
                  {job}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
              Quote fields
            </p>
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] tracking-wide leading-[1.08] text-white mb-6">
              Built around how you price
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {hub.quoteFields.map((field) => (
                <span
                  key={field}
                  className="font-sans text-[13px] font-semibold text-white/80 border border-white/15 px-3.5 py-2 rounded-md"
                >
                  {field}
                </span>
              ))}
            </div>
            <p className="font-sans text-[14px] leading-[1.65] text-white/45 mt-6 max-w-[40ch]">
              {hub.dedicated
                ? "Dedicated quote flow for this trade, with your materials and labour book underneath."
                : "Uses your price book and line items so the quote still matches the way you sell the work."}
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-14 lg:py-16">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] tracking-wide leading-[1.08] text-white mb-8">
            Questions from {hub.plural}
          </h2>
          <div className="max-w-3xl space-y-6">
            {hub.faqs.map((faq) => (
              <div key={faq.question} className="border-b border-white/10 pb-6">
                <p className="font-sans font-bold text-[15.5px] text-white mb-2">{faq.question}</p>
                <p className="font-sans text-[14.5px] leading-[1.65] text-[#c5d4e0]">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-14 text-center">
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] tracking-wide leading-[1.05] text-white mb-4">
            Ready to quote like a {hub.label.toLowerCase()} who sends first?
          </h2>
          <p className="font-sans text-[15.5px] text-[#c5d4e0] mb-8 max-w-[42ch] mx-auto">
            7-day free trial. Unlimited quotes and jobs. Directory listing included.
          </p>
          <Link
            href={signupHref}
            className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-8 py-4 rounded-lg hover:bg-[#e89e00] transition-colors"
          >
            Start free trial <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-6 py-12">
        <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-white/35 mb-4">
          Other trades
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {others.map((h) => (
            <Link
              key={h.key}
              href={`/for/${h.slug}`}
              className="font-sans text-[13.5px] font-semibold text-white/50 hover:text-[#ffb400] transition-colors"
            >
              {h.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
