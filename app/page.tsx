import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import HomeHero from "@/components/marketing/HomeHero";
import CapabilityBands from "@/components/marketing/CapabilityBands";
import QuoteTapDemo from "@/components/marketing/QuoteTapDemo";
import AccountingLogos from "@/components/marketing/AccountingLogos";
import TrialRiskReversal from "@/components/marketing/TrialRiskReversal";
import FaqSchema, { SWIFTSCOPE_FAQS } from "@/components/seo/FaqSchema";
import { homepageMeta } from "@/lib/seo/meta";
import { LEADS_ENABLED } from "@/lib/featureFlags";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 86400;
export const metadata: Metadata = homepageMeta();

async function getListingCount(): Promise<number | null> {
  try {
    const { count, error } = await createPublicClient()
      .from("directory_listing")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? null;
  } catch (err) {
    console.error("[homepage] listing count failed:", err);
    return null;
  }
}

export default async function Home() {
  const listingCount = await getListingCount();

  return (
    <main className="bg-[#1a242c] text-[#071018] overflow-hidden">
      <MarketingNav transparent compact />

      <HomeHero />

      {/* Proof strip */}
      <section className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-[1280px] mx-auto px-6 py-14 sm:py-16">
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-8">
            Built for solo tradies and small crews
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {[
              { n: "7 days", d: "free trial, no card" },
              { n: "$45", d: "flat per month, unlimited seats" },
              { n: "< 4 min", d: "typical on-site quote" },
              {
                n: listingCount !== null ? listingCount.toLocaleString("en-AU") : "Local",
                d: listingCount !== null ? "tradies in the directory" : "tradie directory, free to browse",
              },
            ].map((s) => (
              <div key={s.d}>
                <p className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] tracking-wide text-[#071018] leading-none mb-2">
                  {s.n}
                </p>
                <p className="font-sans text-[13.5px] text-[#5a6a78] leading-snug">{s.d}</p>
              </div>
            ))}
          </div>
          <AccountingLogos tone="light" className="mt-10 pt-8 border-t border-[#e8ecef]" />
        </div>
      </section>

      <CapabilityBands />

      {/* Interactive feel */}
      <section className="bg-[#f4f6f8]">
        <div className="max-w-[1280px] mx-auto px-6 py-16 sm:py-20">
          <QuoteTapDemo />
        </div>
      </section>

      {/* Homeowners: one job */}
      <section className="relative min-h-[60vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/trades/new-external.png"
            alt=""
            fill
            sizes="100vw"
            quality={90}
            className="object-cover object-[center_35%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a242c] via-[#1a242c]/80 to-[#1a242c]/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a242c]/80 via-transparent to-[#1a242c]/30" />
        </div>
        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 py-16 sm:py-20">
          <div className="max-w-[520px]">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
              Need a tradie?
            </p>
            <h2 className="font-display text-[clamp(1.9rem,3.8vw,3rem)] tracking-wide leading-[1.05] text-white mb-4">
              Find someone local. Free, always.
            </h2>
            <p className="font-sans text-[16px] leading-[1.65] text-[#c8d8e4] mb-8">
              Browse by trade and suburb
              {listingCount !== null
                ? ` (${listingCount.toLocaleString("en-AU")} listings)`
                : ""}
              . Real Google ratings. No lead auction.
            </p>
            <Link
              href="/directory"
              className="inline-flex items-center gap-2 bg-white text-[#071018] font-sans font-extrabold text-[15px] px-7 py-3.5 rounded-lg hover:bg-[#f0f3f5] transition-colors"
            >
              Browse the directory <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing: one offer */}
      <section id="pricing" className="bg-white scroll-mt-[88px]">
        <div className="max-w-[1280px] mx-auto px-6 py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">Pricing</p>
            <h2 className="font-display text-[clamp(2rem,4vw,3.2rem)] tracking-wide leading-[1.05] text-[#071018] mb-3">
              Flat $45 a month.
            </h2>
            <p className="font-sans text-[16px] text-[#5a6a78] leading-relaxed mb-8 max-w-[42ch]">
              7-day free trial. Unlimited quotes, jobs, and seats. Directory listing included. No per-lead fees, ever.
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mb-10">
              {[
                "On-site markup and voice quoting",
                "Plan markup with AI assist",
                "Jobs, schedule, and variations",
                "Xero live sync",
                "Unlimited seats",
                "Client accept on their phone",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[14.5px] font-semibold text-[#071018]">
                  <CheckCircle size={16} className="text-[#ffb400] shrink-0" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-col items-start gap-2">
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center bg-[#ffb400] text-[#071018] font-sans font-extrabold text-[15px] px-7 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors"
                >
                  Start free trial
                </Link>
                <Link
                  href="/features"
                  className="inline-flex items-center gap-2 text-[#071018] font-sans font-bold text-[15px] px-6 py-3.5 rounded-lg border border-[#d5dbe0] hover:border-[#071018] transition-colors"
                >
                  See features <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              <TrialRiskReversal tone="dark" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f4f6f8]">
        <div className="max-w-3xl mx-auto px-6 py-14 sm:py-16">
          <h2 className="font-display text-[clamp(1.7rem,3vw,2.2rem)] tracking-wide text-[#071018] mb-8">
            Common questions
          </h2>
          <div className="space-y-5">
            {SWIFTSCOPE_FAQS.map((faq) => (
              <div key={faq.question} className="border-b border-[#e2e5ea] pb-5">
                <p className="font-display text-[1.15rem] tracking-wide text-[#071018] mb-2">{faq.question}</p>
                <p className="font-sans text-[14px] text-[#5a6a78] leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Close + footer */}
      <section className="bg-[#1a242c]">
        <div className="max-w-[1280px] mx-auto px-6 py-16 sm:py-24">
          <p className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-[0.9] tracking-wide text-white mb-4">
            SwiftScope
          </p>
          <h2 className="font-display text-[clamp(1.7rem,3.2vw,2.4rem)] tracking-wide text-white mb-3 max-w-[18ch]">
            The other tradie just sent their quote.
          </h2>
          <p className="font-sans text-[16px] text-[#8aa4b4] mb-8">How long does yours take?</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#ffb400] text-[#071018] font-sans font-extrabold text-[15px] px-8 py-4 rounded-lg hover:bg-[#e89e00] transition-colors"
          >
            Start quoting today <ArrowRight size={15} aria-hidden />
          </Link>
          <TrialRiskReversal tone="light" className="mt-3" />
        </div>

        <div className="border-t border-white/[0.08]">
          <div className="max-w-[1280px] mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-lg tracking-wide text-white">SwiftScope</span>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] font-semibold text-white/40">
              <Link href="/features" className="hover:text-white transition-colors">Features</Link>
              <Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="/for" className="hover:text-white transition-colors">For Tradies</Link>
              <Link href="/tools" className="hover:text-white transition-colors">Tools</Link>
              <Link href="/how-it-works" className="hover:text-white transition-colors">How it works</Link>
              <Link href="/directory" className="hover:text-white transition-colors">Directory</Link>
              <Link href="/areas" className="hover:text-white transition-colors">Areas</Link>
              {LEADS_ENABLED && (
                <Link href="/get-quotes" className="hover:text-white transition-colors">Get quotes</Link>
              )}
              <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
              <Link href="/signup" className="hover:text-white transition-colors">Sign up</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </section>

      <FaqSchema faqs={SWIFTSCOPE_FAQS} />
    </main>
  );
}
