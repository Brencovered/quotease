import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GetQuotesForm from "@/components/GetQuotesForm";
import MarketingNav from "@/components/MarketingNav";
import Link from "next/link";
import {
  Star,
  ShieldCheck,
  ClipboardList,
  Lock,
  BadgeCheck,
  Users,
  Clock,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Icons                                                               */
/* ------------------------------------------------------------------ */

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={
            i <= Math.floor(rating)
              ? "fill-[#ffb400] text-[#ffb400]"
              : i - 0.5 <= rating
              ? "fill-[#ffb400]/50 text-[#ffb400]"
              : "fill-transparent text-[var(--line)]"
          }
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ Accordion (details/summary)                                    */
/* ------------------------------------------------------------------ */

const FAQS = [
  {
    q: "Is this really free?",
    a: "Yes, completely free for homeowners. Tradies pay a small subscription to be listed.",
  },
  {
    q: "How many quotes will I get?",
    a: "Up to 3 local tradies will contact you. You choose who to hire.",
  },
  {
    q: "How quickly do tradies respond?",
    a: "Most homeowners hear back within a few hours. All tradies are local and actively looking for work.",
  },
  {
    q: "Are the tradies verified?",
    a: "Every tradie on Swiftscope has verified Google reviews and a confirmed business listing.",
  },
];

function FAQSection() {
  return (
    <section className="reveal mt-12" style={{ animationDelay: "0.25s" }}>
      <h2 className="font-display text-[1.4rem] text-[var(--ink)] mb-5">
        Common questions
      </h2>
      <div className="space-y-3">
        {FAQS.map((faq, i) => (
          <details
            key={i}
            className="group bg-[var(--surface)] border border-[var(--line)] rounded-xl overflow-hidden cursor-pointer"
          >
            <summary className="flex items-center justify-between px-5 py-4 list-none select-none">
              <span className="font-semibold text-[13.5px] text-[var(--ink)]">
                {faq.q}
              </span>
              <ChevronRight
                size={16}
                className="text-[var(--ink-faint)] group-open:rotate-90 transition-transform duration-200 shrink-0 ml-3"
              />
            </summary>
            <div className="px-5 pb-4 text-[13px] text-[var(--ink-soft)] leading-relaxed">
              {faq.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Trust sidebar                                                       */
/* ------------------------------------------------------------------ */

const TRUST_ITEMS = [
  {
    icon: <Star size={18} />,
    title: "Real Google ratings",
    body: "Every tradie has verified reviews",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "Verified businesses",
    body: "We check every listing",
  },
  {
    icon: <ClipboardList size={18} />,
    title: "Up to 3 quotes",
    body: "Compare and choose, no pressure",
  },
  {
    icon: <Lock size={18} />,
    title: "No spam",
    body: "Your details only go to matched tradies",
  },
  {
    icon: <BadgeCheck size={18} />,
    title: "Free forever",
    body: "No cost to homeowners, ever",
  },
];

const TIMELINE = [
  {
    step: "1",
    title: "Post your job",
    desc: "2 minutes",
  },
  {
    step: "2",
    title: "Tradies respond",
    desc: "Usually within hours",
  },
  {
    step: "3",
    title: "Compare and hire",
    desc: "Your choice",
  },
];

function TrustSidebar() {
  return (
    <aside className="reveal space-y-6" style={{ animationDelay: "0.15s" }}>
      {/* Why trust */}
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6">
        <h3 className="font-display text-[1.15rem] text-[var(--ink)] mb-4">
          Why homeowners trust Swiftscope
        </h3>
        <div className="space-y-4">
          {TRUST_ITEMS.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--amber-light)] flex items-center justify-center text-[var(--amber-deep)] shrink-0 mt-0.5">
                {item.icon}
              </div>
              <div>
                <p className="font-semibold text-[13px] text-[var(--ink)]">
                  {item.title}
                </p>
                <p className="text-[12.5px] text-[var(--ink-soft)]">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6">
        <h3 className="font-display text-[1.15rem] text-[var(--ink)] mb-4">
          What happens next
        </h3>
        <div className="relative space-y-5">
          {/* connecting line */}
          <div
            className="absolute left-[15px] top-2 bottom-2 w-px bg-[var(--line)]"
            aria-hidden="true"
          />
          {TIMELINE.map((t, i) => (
            <div key={i} className="flex items-start gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-[var(--navy)] text-white flex items-center justify-center text-[11px] font-bold shrink-0 z-10">
                {t.step}
              </div>
              <div>
                <p className="font-semibold text-[13px] text-[var(--ink)]">
                  {t.title}
                </p>
                <p className="text-[12.5px] text-[var(--ink-soft)]">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Social proof card */}
      <div className="bg-[var(--navy)] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-1.5">
            <StarRating rating={4.8} />
          </div>
          <span className="font-bold text-[14px]">4.8</span>
        </div>
        <p className="text-[13px] text-[var(--steel-2)]">
          Average rating from{" "}
          <span className="text-white font-semibold">312 reviews</span>
        </p>
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-[12px] text-[var(--steel-2)]">
          <Users size={14} />
          <span>
            <span className="text-white font-semibold">196+</span> verified
            tradies listed
          </span>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Bottom CTA                                                          */
/* ------------------------------------------------------------------ */

function BottomCTA() {
  return (
    <section
      className="reveal mt-14 -mx-4 sm:-mx-8 lg:-mx-12 px-4 sm:px-8 lg:px-12 py-12"
      style={{ animationDelay: "0.35s", background: "var(--navy)" }}
    >
      <div className="max-w-xl mx-auto text-center">
        <h2 className="font-display text-[1.5rem] text-white mb-2">
          Not sure what trade you need?
        </h2>
        <p className="text-[var(--steel-2)] text-[14px] mb-6">
          Browse our directory of 196+ verified tradies
        </p>
        <Link
          href="/directory"
          className="inline-flex items-center gap-2 bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[14px] px-6 py-3 rounded-xl hover:bg-[var(--amber-deep)] transition-colors"
        >
          Browse directory
          <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default async function GetQuotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if homeowner profile exists
  let homeowner = null;
  if (user) {
    const { data } = await supabase
      .from("homeowner_profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    homeowner = data;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--app-bg)" }}>
      {/* Nav */}
      <MarketingNav transparent={false} />

      {/* Hero */}
      <div style={{ background: "var(--navy)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 lg:pt-14 lg:pb-16">
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="reveal inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3.5 py-1.5 mb-5">
              <BadgeCheck size={14} className="text-[var(--amber)]" />
              <span className="text-[12px] font-bold text-white/90">
                Free for homeowners - always
              </span>
            </div>

            <h1 className="reveal font-display text-[2rem] sm:text-[2.4rem] lg:text-[2.8rem] leading-[1.1] text-white mb-3">
              Get up to 3 free quotes from local tradies
            </h1>

            <p
              className="reveal text-[14px] sm:text-[15px] leading-relaxed mb-4"
              style={{ color: "var(--steel-2)", animationDelay: "0.05s" }}
            >
              Describe your job once. Matched local tradies contact you directly.
              No spam, no auction.
            </p>

            {/* Live counter */}
            <div
              className="reveal inline-flex items-center gap-2.5 bg-[var(--green-bg)] rounded-lg px-4 py-2"
              style={{ animationDelay: "0.1s" }}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--green)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--green)]" />
              </span>
              <span className="text-[12.5px] font-semibold text-[var(--green)]">
                47 homeowners posted jobs this week
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content - two column */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          {/* Left column - form area (60%) */}
          <div className="w-full lg:w-[60%] lg:min-w-0">
            {/* Form card */}
            <div className="reveal bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-7">
              <GetQuotesForm user={user} homeowner={homeowner} />
            </div>

            {/* FAQ */}
            <FAQSection />

            {/* Bottom CTA (mobile only - shown inline) */}
            <div className="lg:hidden mt-10">
              <div
                className="rounded-2xl p-6 text-center"
                style={{ background: "var(--navy)" }}
              >
                <h2 className="font-display text-[1.3rem] text-white mb-2">
                  Not sure what trade you need?
                </h2>
                <p className="text-[var(--steel-2)] text-[13px] mb-5">
                  Browse our directory of 196+ verified tradies
                </p>
                <Link
                  href="/directory"
                  className="inline-flex items-center gap-2 bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[13px] px-5 py-2.5 rounded-xl hover:bg-[var(--amber-deep)] transition-colors"
                >
                  Browse directory
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* Right column - trust sidebar (40%) */}
          <div className="hidden lg:block w-full lg:w-[40%]">
            <div className="lg:sticky lg:top-6">
              <TrustSidebar />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA (desktop - full width) */}
      <div className="hidden lg:block max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <BottomCTA />
      </div>

      {/* Footer spacer */}
      <div className="h-8" />
    </div>
  );
}
