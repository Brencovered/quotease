import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import SavingsCalculator from "@/components/SavingsCalculator";
import InteractiveQuoteDemo from "@/components/marketing/InteractiveQuoteDemo";
import FaqSchema, { SWIFTSCOPE_FAQS } from "@/components/seo/FaqSchema";
import { homepageMeta } from "@/lib/seo/meta";
import { LEADS_ENABLED } from "@/lib/featureFlags";
import { createPublicClient } from "@/lib/supabase/public";

// Listing count drifts as the directory grows; refresh daily so the
// homepage doesn't understate it for weeks. createPublicClient (not the
// cookie client) keeps this page statically prerenderable.
export const revalidate = 86400;

export const metadata: Metadata = homepageMeta();

const HERO_IMG = "/trades/hero-onsite.jpg";
const HERO_BLUR =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAJABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBAm6IL0JFQ/ZZYFZ7jhO1aZ+9HTtd/5Bq/WmJWP//Z";

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

const STEPS = [
  {
    n: "01",
    title: "Scope it on site",
    body: "Mark the photo, talk the job, or annotate the plan — whatever matches how you already work.",
  },
  {
    n: "02",
    title: "Price it from your book",
    body: "Materials and labour load from your rates. No retyping numbers back at the desk.",
  },
  {
    n: "03",
    title: "Send before you leave",
    body: "Client gets a clean quote they can accept on their phone. You get the yes while you're still there.",
  },
] as const;

export default async function Home() {
  const listingCount = await getListingCount();

  return (
    <main className="bg-white text-[#0a1722] overflow-hidden">
      {/* HERO — one composition: brand, headline, sentence, CTAs, full-bleed site photo */}
      <section className="relative min-h-[100svh] max-h-[960px] flex flex-col bg-[#0a1722]">
        <MarketingNav transparent />
        <div className="absolute inset-0 z-0">
          <Image
            src={HERO_IMG}
            alt="Tradie working on site in dust mask and ear protection"
            fill
            sizes="100vw"
            className="object-cover object-center home-hero-kenburns"
            priority
            placeholder="blur"
            blurDataURL={HERO_BLUR}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1722] via-[#0a1722]/55 to-[#0a1722]/25" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1722]/75 via-[#0a1722]/35 to-transparent" />
        </div>

        <div className="relative z-10 flex-1 flex items-end">
          <div className="max-w-7xl mx-auto px-6 pb-16 sm:pb-20 w-full">
            <div className="max-w-[640px] home-hero-copy">
              <p className="font-display text-[3rem] sm:text-[4rem] lg:text-[4.6rem] leading-[0.9] tracking-wide text-white mb-4">
                SWIFTSCOPE
              </p>
              <h1 className="font-display uppercase leading-[0.92] mb-5">
                <span className="block text-[2.1rem] sm:text-[3rem] lg:text-[3.4rem] text-white">
                  Quote it on site.
                </span>
                <span className="block text-[2.1rem] sm:text-[3rem] lg:text-[3.4rem] text-[#ffb400]">
                  Win it before you leave.
                </span>
              </h1>
              <p className="text-[17px] sm:text-[18px] leading-[1.6] text-[#c8d8e4] max-w-[480px] mb-9">
                Site-first quoting for trade teams of 1 to 10. Mark it up, price it from your book, send it from the driveway.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[16px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors"
                >
                  I&apos;m a tradie — start free
                </Link>
                <Link
                  href="/directory"
                  className="text-white font-bold text-[16px] px-6 py-4 rounded-xl border border-white/25 hover:border-white/50 transition-colors inline-flex items-center gap-2"
                >
                  I need a tradie <ArrowRight size={16} aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRY IT — interaction is the point of this section */}
      <section className="border-b border-[#e8ecef] bg-[linear-gradient(180deg,#f7f9fb_0%,#ffffff_42%)]">
        <div className="max-w-7xl mx-auto px-6 py-16 sm:py-20">
          <InteractiveQuoteDemo />
        </div>
      </section>

      {/* HOW IT WORKS — one job, three steps, one product visual */}
      <section className="border-b border-[#e8ecef] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-16 sm:py-20">
          <div className="max-w-[560px] mb-12">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">How it works</p>
            <h2 className="font-display uppercase text-[2.3rem] sm:text-[3rem] leading-[0.93] text-[#0a1722] mb-4">
              Three moves. Quote done.
            </h2>
            <p className="text-[15.5px] text-[#5a6a78] leading-relaxed">
              Built to be used standing in the job — not back at a desk rewriting notes into a spreadsheet.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <ol className="space-y-0">
              {STEPS.map((step, i) => (
                <li
                  key={step.n}
                  className={`py-6 ${i < STEPS.length - 1 ? "border-b border-[#e8ecef]" : ""}`}
                >
                  <div className="flex gap-5">
                    <span className="font-display text-[1.5rem] text-[#ffb400] leading-none pt-0.5 tabular-nums">
                      {step.n}
                    </span>
                    <div>
                      <h3 className="font-display text-[1.35rem] text-[#0a1722] mb-1.5">{step.title}</h3>
                      <p className="text-[14.5px] text-[#5a6a78] leading-relaxed max-w-[420px]">{step.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="relative flex justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,180,0,0.14),transparent_60%)] pointer-events-none" />
              <div className="relative w-full max-w-[280px] sm:max-w-[300px] bg-[#0a1722] p-2.5 shadow-[0_28px_60px_rgba(10,23,34,0.28)]" style={{ borderRadius: 28 }}>
                <div className="overflow-hidden bg-white" style={{ borderRadius: 20 }}>
                  <Image
                    src="/marketing/v2/quoting.png"
                    alt="Swiftscope quote builder on a phone"
                    width={453}
                    height={918}
                    className="w-full h-auto"
                    sizes="(max-width: 640px) 70vw, 300px"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#0a1722] hover:text-[#e89e00] transition-colors"
            >
              See the full walkthrough <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* HOMEOWNERS — one purpose */}
      <section className="relative border-b border-[#12212f] bg-[#0a1722] overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/trades/electrician.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[70%_center] opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1722] via-[#0a1722]/80 to-[#0a1722]/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1722]/70 via-transparent to-[#0a1722]/30" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-16 sm:py-20">
          <div className="max-w-[520px]">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              Looking for a tradie?
            </p>
            <h2 className="font-display uppercase text-[2.3rem] sm:text-[3rem] leading-[0.93] text-white mb-4">
              Find someone local. Free, always.
            </h2>
            <p className="text-[15.5px] text-[#c8d8e4] leading-relaxed mb-8">
              Browse by trade and suburb. Real Google ratings on every listing
              {listingCount !== null
                ? ` — ${listingCount.toLocaleString("en-AU")} tradies across the directory`
                : ""}
              . No lead auction, no signup required to look.
            </p>
            <Link
              href="/directory"
              className="inline-flex items-center gap-2 bg-white text-[#0a1722] font-extrabold text-[15px] px-7 py-3.5 rounded-xl hover:bg-[#f0f3f5] transition-colors"
            >
              Browse the directory <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* PRICING — one offer */}
      <section className="border-b border-[#e8ecef] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-16 sm:py-20">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Pricing</p>
            <h2 className="font-display uppercase text-[2.3rem] sm:text-[3rem] leading-[0.93] text-[#0a1722] mb-4">
              Flat $45 a month.
            </h2>
            <p className="text-[15.5px] text-[#5a6a78] leading-relaxed">
              7-day free trial, no card. Unlimited quotes, jobs, and team members. Directory listing included.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mb-10 text-left">
              {[
                "Unlimited quotes and jobs",
                "Unlimited team members",
                "On-site markup and voice quoting",
                "Job management and scheduling",
                "Xero live sync",
                "Listed in the public directory",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[14.5px] font-semibold text-[#0a1722]">
                  <CheckCircle size={16} className="text-[#ffb400] shrink-0" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors"
              >
                Start free trial
              </Link>
              <Link
                href="/features"
                className="text-[#0a1722] font-bold text-[15px] px-6 py-4 rounded-xl border border-[#d5dbe0] hover:border-[#0a1722] transition-colors inline-flex items-center gap-2"
              >
                Compare features <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SAVINGS — interactive */}
      <section className="border-b border-[#e8ecef] bg-[#f7f9fb]">
        <div className="max-w-7xl mx-auto px-6 py-16 sm:py-20">
          <div className="text-center mb-10 max-w-xl mx-auto">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">
              Savings calculator
            </p>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] text-[#0a1722] mb-4">
              What are you paying now?
            </h2>
            <p className="text-[15px] text-[#5a6a78]">
              Pick the tools you already use. See the monthly difference against Swiftscope&apos;s flat rate.
            </p>
          </div>
          <SavingsCalculator />
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="bg-[#0a1722]">
        <div className="max-w-7xl mx-auto px-6 py-16 sm:py-20">
          <div className="max-w-[560px]">
            <p className="font-display text-[1.6rem] text-white mb-2">SWIFTSCOPE</p>
            <h2 className="font-display uppercase text-[2.2rem] sm:text-[2.8rem] leading-[0.93] text-white mb-4">
              The other tradie just sent their quote.
            </h2>
            <p className="text-[15.5px] text-[#8aa4b4] mb-8">How long does yours take?</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-8 py-4 rounded-xl hover:bg-[#e89e00] transition-colors"
              >
                Start quoting today <ArrowRight size={15} aria-hidden />
              </Link>
              <Link
                href="/directory"
                className="inline-flex items-center gap-2 text-white font-bold text-[15px] px-6 py-4 rounded-xl border border-white/20 hover:border-white/45 transition-colors"
              >
                Find a tradie
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-lg text-white">SWIFTSCOPE</span>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] font-semibold text-white/40">
              <Link href="/features" className="hover:text-white transition-colors">Features</Link>
              <Link href="/how-it-works" className="hover:text-white transition-colors">How it works</Link>
              <Link href="/directory" className="hover:text-white transition-colors">Directory</Link>
              <Link href="/areas" className="hover:text-white transition-colors">Areas we cover</Link>
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

      <section className="bg-[#f7f9fb] border-t border-[#e8ecef]">
        <div className="max-w-3xl mx-auto px-6 py-14 sm:py-16">
          <h2 className="font-display uppercase text-[2rem] text-[#0a1722] mb-8">Common questions</h2>
          <div className="space-y-5">
            {SWIFTSCOPE_FAQS.map((faq) => (
              <div key={faq.question} className="border-b border-[#e8ecef] pb-5">
                <p className="font-bold text-[15px] text-[#0a1722] mb-2">{faq.question}</p>
                <p className="text-[14px] text-[#5a6a78] leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FaqSchema faqs={SWIFTSCOPE_FAQS} />
    </main>
  );
}
