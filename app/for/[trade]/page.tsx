import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import TradeJobDemo from "@/components/marketing/TradeJobDemo";
import TradeQuoteFieldsInteractive from "@/components/marketing/TradeQuoteFieldsInteractive";
import TrialRiskReversal from "@/components/marketing/TrialRiskReversal";
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
    openGraph: {
      title: `${hub.metaTitle} - Swiftscope`,
      description: hub.metaDescription,
      images: [{ url: hub.heroImage }],
    },
  };
}

export default async function TradeHubPage({ params }: PageProps) {
  const { trade } = await params;
  const hub = getTradeHubBySlug(trade);
  if (!hub) notFound();

  const others = TRADE_HUBS.filter((h) => h.key !== hub.key);
  const signupHref = `/signup?trade=${encodeURIComponent(hub.key)}`;

  return (
    <main className="bg-[#f4f6f8] text-[#071018] min-h-screen">
      <MarketingNav transparent />
      <FaqSchema faqs={hub.faqs} />

      <section className="relative min-h-[88svh] lg:min-h-[100svh] overflow-hidden bg-[#1a242c]">
        <Image
          src={hub.heroImage}
          alt={hub.heroAlt}
          fill
          priority
          sizes="100vw"
          quality={90}
          className={`object-cover ${hub.heroPos}`}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(26,36,44,0.94) 0%, rgba(26,36,44,0.82) 38%, rgba(26,36,44,0.45) 68%, rgba(26,36,44,0.55) 100%)",
          }}
        />
        <div className="absolute inset-y-0 left-0 w-full max-w-[720px] bg-gradient-to-r from-[#1a242c] via-[#1a242c]/75 to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-[1280px] mx-auto px-5 sm:px-6 pt-28 pb-14 lg:pt-36 lg:pb-20 min-h-[88svh] lg:min-h-[100svh] flex flex-col justify-end lg:justify-center">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-end lg:items-center">
            <div className="lg:col-span-6 xl:col-span-5 home-hero-copy">
              <p className="font-display text-[clamp(2rem,5vw,2.8rem)] tracking-wide text-white mb-2">
                SwiftScope
              </p>
              <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#ffb400] mb-5">
                For {hub.slang}
              </p>
              <h1 className="font-display text-[clamp(2.1rem,4.8vw,3.4rem)] tracking-wide leading-[1.02] text-white max-w-[15ch] mb-5">
                {hub.headline}
              </h1>
              <p className="font-sans text-[17px] leading-[1.65] text-[#e8eef2] max-w-[38ch] mb-8">
                {hub.subhead}
              </p>
              <div className="flex flex-col items-start gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={signupHref}
                    className="inline-flex items-center gap-2 bg-[#ffb400] text-[#1a242c] font-extrabold text-[15px] px-6 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors"
                  >
                    Try it free <ArrowRight size={15} aria-hidden />
                  </Link>
                  <Link
                    href="/tools/charge-out-rate"
                    className="inline-flex items-center gap-2 font-sans text-[14.5px] font-semibold text-white/80 hover:text-white transition-colors px-2 py-3"
                  >
                    Charge-out calculator <ArrowRight size={14} aria-hidden />
                  </Link>
                </div>
                <TrialRiskReversal tone="light" />
              </div>
            </div>

            <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 justify-end">
              <div className="relative w-[min(260px,26vw)] home-phone-float">
                <Image
                  src={hub.phoneImage}
                  alt={hub.phoneAlt}
                  width={325}
                  height={658}
                  className="w-full h-auto drop-shadow-[0_28px_50px_rgba(0,0,0,0.45)]"
                  sizes="260px"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f4f6f8]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5">
            <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#b88400] mb-3">
              The problem
            </p>
            <h2 className="font-display text-[clamp(1.75rem,3.2vw,2.45rem)] tracking-wide leading-[1.08] text-[#071018] mb-5 max-w-[16ch]">
              Why quotes stall
            </h2>
            <p className="font-sans text-[17px] leading-[1.7] text-[#3d4a55] max-w-[40ch] mb-8">
              {hub.pain}
            </p>
            <ul className="space-y-4">
              {hub.outcomes.map((item) => (
                <li key={item} className="flex items-start gap-3.5 font-sans text-[16px] leading-[1.5] text-[#071018]">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffb400]/20">
                    <Check size={14} className="text-[#b88400]" aria-hidden />
                  </span>
                  <span className="font-medium text-[#1a242c]">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7">
            <div className="relative aspect-[4/5] sm:aspect-[16/11] overflow-hidden">
              <Image
                src={hub.supportImage}
                alt={hub.supportAlt}
                fill
                sizes="(max-width: 1024px) 100vw, 640px"
                quality={90}
                className={`object-cover ${hub.supportPos}`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Interactive common jobs */}
      <section className="bg-white border-y border-[#e4e8ec]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 py-16 lg:py-20">
          <TradeJobDemo tradeLabel={hub.label} jobs={hub.demoJobs} />
        </div>
      </section>

      {/* Compliance callout */}
      <section className="bg-[#f4f6f8] border-y border-[#e4e8ec]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 py-14 lg:py-16 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#b88400] mb-3">
              Compliance & paperwork
            </p>
            <h2 className="font-display text-[clamp(1.75rem,3.2vw,2.45rem)] tracking-wide leading-[1.08] text-[#071018] mb-4 max-w-[18ch]">
              {hub.compliance.title}
            </h2>
            <p className="font-sans text-[16px] leading-[1.7] text-[#3d4a55] max-w-[48ch]">
              {hub.compliance.body}
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="border border-[#e4e8ec] bg-white px-6 py-7 flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ffb400]/20">
                <ShieldCheck size={22} className="text-[#b88400]" aria-hidden />
              </span>
              <div>
                <p className="font-sans text-[11px] font-bold tracking-[0.16em] uppercase text-[#b88400] mb-1">
                  {hub.compliance.badge}
                </p>
                <p className="font-sans text-[15px] leading-[1.55] text-[#3d4a55]">
                  Kept with the quote and the job — not lost in a text thread or a folder in the ute.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive quote fields */}
      <section className="bg-white border-b border-[#e4e8ec]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 py-16 lg:py-20">
          <TradeQuoteFieldsInteractive fields={hub.quoteFieldDetails} dedicated={hub.dedicated} />
        </div>
      </section>

      <section className="bg-[#f4f6f8]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 py-16 lg:py-20">
          <h2 className="font-display text-[clamp(1.75rem,3.2vw,2.45rem)] tracking-wide leading-[1.08] text-[#071018] mb-10 max-w-[18ch]">
            Questions from {hub.plural}
          </h2>
          <div className="max-w-3xl space-y-0">
            {hub.faqs.map((faq) => (
              <div key={faq.question} className="border-b border-[#e4e8ec] py-7 first:pt-0">
                <h3 className="font-display text-[1.15rem] tracking-wide text-[#071018] mb-2.5">
                  {faq.question}
                </h3>
                <p className="font-sans text-[16px] leading-[1.7] text-[#3d4a55] max-w-[54ch]">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white border-y border-[#e4e8ec]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 py-16 lg:py-20">
          <p className="font-display text-[clamp(1.6rem,3vw,2.2rem)] tracking-wide text-[#071018] mb-3">
            SwiftScope
          </p>
          <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] tracking-wide leading-[1.05] text-[#071018] mb-4 max-w-[16ch]">
            Send your next quote before you leave site.
          </h2>
          <p className="font-sans text-[16px] leading-[1.65] text-[#3d4a55] mb-8 max-w-[40ch]">
            7-day free trial. Unlimited quotes and jobs. Directory listing included.
          </p>
          <div className="flex flex-col items-start gap-2">
            <Link
              href={signupHref}
              className="inline-flex items-center gap-2 bg-[#ffb400] text-[#1a242c] font-extrabold text-[15px] px-8 py-4 rounded-lg hover:bg-[#e89e00] transition-colors"
            >
              Start free trial <ArrowRight size={15} aria-hidden />
            </Link>
            <TrialRiskReversal />
          </div>
        </div>
      </section>

      <section className="bg-[#f4f6f8] border-t border-[#e4e8ec]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 py-14 lg:py-16">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#b88400] mb-2">
                Other trades
              </p>
              <h2 className="font-display text-[1.6rem] tracking-wide text-[#071018]">
                Built the same way
              </h2>
            </div>
            <Link
              href="/for"
              className="font-sans text-[14px] font-bold text-[#071018] hover:text-[#b88400] transition-colors inline-flex items-center gap-1.5"
            >
              View all <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {others.slice(0, 8).map((h) => (
              <li key={h.key}>
                <Link
                  href={`/for/${h.slug}`}
                  className="group flex items-center gap-3 bg-white border border-[#e4e8ec] px-3 py-3 hover:border-[#071018] transition-colors"
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden">
                    <Image
                      src={h.heroImage}
                      alt=""
                      fill
                      sizes="48px"
                      className={`object-cover ${h.heroPos}`}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[1.05rem] tracking-wide text-[#071018] group-hover:text-[#b88400] transition-colors truncate">
                      {h.label}
                    </span>
                    <span className="block font-sans text-[12.5px] text-[#5a6a78] truncate">
                      For {h.slang}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
