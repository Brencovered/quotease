import Image from "next/image";
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
    <main className="bg-[#1a242c] text-white min-h-screen">
      <MarketingNav transparent />
      <FaqSchema faqs={hub.faqs} />

      <section className="relative min-h-[100svh] overflow-hidden">
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
              "linear-gradient(105deg, rgba(26,36,44,0.88) 0%, rgba(26,36,44,0.72) 42%, rgba(26,36,44,0.28) 70%, rgba(26,36,44,0.45) 100%)",
          }}
        />
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 pt-28 pb-16 lg:pt-36 lg:pb-24 min-h-[100svh] flex flex-col justify-end lg:justify-center">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-end lg:items-center">
            <div className="lg:col-span-6 xl:col-span-5">
              <p className="font-display text-[clamp(1.8rem,4vw,2.6rem)] tracking-wide text-white mb-3">
                SwiftScope
              </p>
              <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-4">
                For {hub.plural}
              </p>
              <h1 className="font-display text-[clamp(2rem,4.6vw,3.3rem)] tracking-wide leading-[1.02] text-white max-w-[16ch] mb-4">
                {hub.headline}
              </h1>
              <p className="font-sans text-[16px] leading-[1.65] text-[#d5e0e8] max-w-[40ch] mb-8">
                {hub.subhead}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href={signupHref}
                  className="inline-flex items-center gap-2 bg-[#ffb400] text-[#1a242c] font-extrabold text-[14.5px] px-6 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors"
                >
                  Try it free <ArrowRight size={15} aria-hidden />
                </Link>
                <Link
                  href="/tools/charge-out-rate"
                  className="inline-flex items-center gap-2 font-sans text-[14px] font-semibold text-white/75 hover:text-white transition-colors"
                >
                  Free charge-out calculator <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </div>

            <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 justify-end">
              <div className="relative w-[min(280px,28vw)] home-phone-float">
                <Image
                  src={hub.phoneImage}
                  alt={hub.phoneAlt}
                  width={325}
                  height={658}
                  className="w-full h-auto drop-shadow-[0_28px_50px_rgba(0,0,0,0.4)]"
                  sizes="280px"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support photo is always a different image from the hero */}
      <section className="border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-14 lg:py-20 grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5 order-2 lg:order-1">
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] tracking-wide leading-[1.08] text-white mb-4 max-w-[18ch]">
              Why quotes stall
            </h2>
            <p className="font-sans text-[15.5px] leading-[1.7] text-[#c5d4e0] max-w-[42ch] mb-7">
              {hub.pain}
            </p>
            <ul className="space-y-3.5">
              {hub.outcomes.map((item) => (
                <li key={item} className="flex items-start gap-3 font-sans text-[15px] text-white/85">
                  <Check size={16} className="mt-1 shrink-0 text-[#ffb400]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="relative aspect-[4/5] sm:aspect-[16/11] overflow-hidden rounded-2xl">
              <Image
                src={hub.supportImage}
                alt={hub.supportAlt}
                fill
                sizes="(max-width: 1024px) 100vw, 640px"
                quality={90}
                className={`object-cover ${hub.supportPos}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a242c]/50 via-transparent to-transparent" />
              <div className="absolute bottom-5 right-5 sm:bottom-7 sm:right-8 w-[38%] max-w-[190px] lg:hidden">
                <Image
                  src={hub.phoneImage}
                  alt={hub.phoneAlt}
                  width={325}
                  height={658}
                  className="w-full h-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.4)]"
                  sizes="190px"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#22303a]">
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

      <section className="border-b border-white/10 bg-[#22303a]">
        <div className="max-w-[1280px] mx-auto px-6 py-16 text-center">
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] tracking-wide leading-[1.05] text-white mb-4">
            Send your next quote before you leave site.
          </h2>
          <p className="font-sans text-[15.5px] text-[#c5d4e0] mb-8 max-w-[42ch] mx-auto">
            7-day free trial. Unlimited quotes and jobs. Directory listing included.
          </p>
          <Link
            href={signupHref}
            className="inline-flex items-center gap-2 bg-[#ffb400] text-[#1a242c] font-extrabold text-[15px] px-8 py-4 rounded-lg hover:bg-[#e89e00] transition-colors"
          >
            Start free trial <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-6 py-12">
        <div className="flex items-end justify-between gap-4 mb-6">
          <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-white/40">
            Other trades
          </p>
          <Link href="/for" className="font-sans text-[13px] font-semibold text-white/50 hover:text-white transition-colors">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {others.slice(0, 8).map((h) => (
            <Link
              key={h.key}
              href={`/for/${h.slug}`}
              className="group relative aspect-[5/4] overflow-hidden rounded-xl"
            >
              <Image
                src={h.heroImage}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className={`object-cover transition-transform duration-500 group-hover:scale-[1.04] ${h.heroPos}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a242c]/90 via-[#1a242c]/25 to-transparent" />
              <span className="absolute bottom-3 left-3 right-3 font-display text-[1.05rem] tracking-wide text-white">
                {h.label}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
