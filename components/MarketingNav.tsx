"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import { LEADS_ENABLED, CLAIMED_DIRECTORY_PAGES_ENABLED } from "@/lib/featureFlags";
import { TRADE_PAGES } from "@/lib/marketing/tradePages";

/**
 * Shared top nav for the marketing site (home, /features, /how-it-works).
 * Stays fixed on scroll so Sign up free remains visible.
 * `transparent` starts clear over the homepage hero, then solidifies on scroll.
 *
 * Trades is a dropdown rather than a plain link because there is no index
 * page at /quoting-software: the six trade pages are the destination, and
 * a menu gets a visitor to their own trade in one click instead of two. It
 * reads TRADE_PAGES directly, so adding a trade adds a menu item.
 *
 * Merged from two branches that touched this file independently: main
 * added the scroll-solidify behaviour and the compact prop; the trade
 * pages branch added this dropdown, which is also the only real
 * navigation entry point those six pages have ever had -- they existed
 * with zero incoming links from anywhere on the live site until this
 * merge, which is the direct explanation for zero recorded sessions
 * entering through them despite the pages themselves being built weeks
 * earlier.
 *
 * The mid-nav "Directory" text link used to only be hidden on the
 * homepage (via `compact`) - every other page rendered it alongside
 * the near-identical "Find a tradie" button on the right, which is
 * redundant (same destination) and was exactly what made the nav feel
 * squashed on every non-homepage page: 8 primary links plus 2-3 pill
 * buttons plus Log in/Sign up all fighting for one 1280px row. Removed
 * outright rather than re-scoped to `compact`, since it added nothing
 * "Find a tradie" doesn't already cover on any page.
 */
export default function MarketingNav({
  transparent = false,
  compact = false,
}: {
  transparent?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const tradesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Pointer-only open/close strands keyboard and touch users with a menu
  // they cannot dismiss, so the button toggles too and both Escape and a
  // click anywhere else close it.
  useEffect(() => {
    if (!tradesOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!tradesRef.current?.contains(e.target as Node)) setTradesOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setTradesOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [tradesOpen]);

  const solid = !transparent || scrolled || open;

  return (
    <>
      <div
        className={[
          "fixed top-0 left-0 right-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-200",
          solid
            ? "bg-[#1a242c]/95 backdrop-blur-md border-b border-white/10"
            : "bg-transparent border-b border-transparent",
        ].join(" ")}
      >
        <div className="max-w-[1280px] mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="font-display text-xl tracking-wide text-white drop-shadow-lg shrink-0">
            SwiftScope
          </Link>

          <div className="hidden lg:flex items-center gap-7">
            <Link href="/features" className="text-white/75 hover:text-white font-semibold text-sm transition-colors">
              Features
            </Link>
            <Link href="/#pricing" className="text-white/75 hover:text-white font-semibold text-sm transition-colors">
              Pricing
            </Link>

            <div
              ref={tradesRef}
              className="relative"
              onMouseEnter={() => setTradesOpen(true)}
              onMouseLeave={() => setTradesOpen(false)}
            >
              <button
                type="button"
                onClick={() => setTradesOpen((v) => !v)}
                aria-expanded={tradesOpen}
                aria-haspopup="true"
                className="flex items-center gap-1.5 text-white/75 hover:text-white font-semibold text-sm transition-colors"
              >
                Trades
                <ChevronDown size={14} className={`transition-transform ${tradesOpen ? "rotate-180" : ""}`} />
              </button>

              {tradesOpen && (
                <div className="absolute left-0 top-full pt-3 w-[260px]">
                  <div className="bg-[#12212f] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1.5">
                    {TRADE_PAGES.map((t) => (
                      <Link
                        key={t.slug}
                        href={`/quoting-software/${t.slug}`}
                        onClick={() => setTradesOpen(false)}
                        className="block px-4 py-2.5 font-semibold text-[14px] text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        {t.Trade}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link href="/for" className="text-white/75 hover:text-white font-semibold text-sm transition-colors">
              For Tradies
            </Link>
            <Link href="/tools" className="text-white/75 hover:text-white font-semibold text-sm transition-colors">
              Tools
            </Link>
            <Link href="/how-it-works" className="text-white/75 hover:text-white font-semibold text-sm transition-colors">
              How it works
            </Link>
            <Link href="/blog" className="text-white/75 hover:text-white font-semibold text-sm transition-colors">
              Blog
            </Link>
          </div>

          <div className="hidden lg:flex items-center gap-2.5">
            <Link
              href="/directory"
              className="text-white/85 hover:text-white font-semibold text-[13.5px] px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 transition-colors"
            >
              Find a tradie
            </Link>
            {CLAIMED_DIRECTORY_PAGES_ENABLED && (
              <Link
                href="/directory/claim"
                className="text-white/85 hover:text-white font-semibold text-[13.5px] px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 transition-colors"
              >
                Manage your listing
              </Link>
            )}
            {!compact && LEADS_ENABLED && (
              <Link
                href="/get-quotes"
                className="text-white/85 hover:text-white font-semibold text-[13.5px] px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 transition-colors"
              >
                Get a quote
              </Link>
            )}
            <Link
              href="/login"
              className="text-white/75 hover:text-white font-semibold text-[13.5px] px-3 py-2 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-[#ffb400] text-[#0a1722] font-sans font-extrabold text-[13.5px] px-5 py-2.5 rounded-lg hover:bg-[#e89e00] transition-colors"
            >
              Sign up free
            </Link>
          </div>

          <button onClick={() => setOpen((v) => !v)} className="lg:hidden text-white p-1" aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {open && (
          <div className="lg:hidden bg-[#1a242c] border-t border-white/10 px-6 py-5 flex flex-col gap-1 max-h-[calc(100vh-72px)] overflow-y-auto">
            <Link href="/features" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">
              Features
            </Link>
            <Link href="/#pricing" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">
              Pricing · $45/mo
            </Link>

            <p className="text-white/45 font-semibold text-[11px] uppercase tracking-wide pt-3 pb-1">Trades</p>
            {TRADE_PAGES.map((t) => (
              <Link
                key={t.slug}
                href={`/quoting-software/${t.slug}`}
                onClick={() => setOpen(false)}
                className="text-white/85 font-semibold text-[15px] py-2 pl-1"
              >
                {t.Trade}
              </Link>
            ))}

            <Link href="/for" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5 mt-2">
              For Tradies
            </Link>
            <Link href="/tools" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">
              Tools
            </Link>
            <Link href="/how-it-works" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">
              How it works
            </Link>
            <Link href="/blog" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">
              Blog
            </Link>
            <Link href="/directory" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">
              Find a tradie
            </Link>
            {CLAIMED_DIRECTORY_PAGES_ENABLED && (
              <Link
                href="/directory/claim"
                onClick={() => setOpen(false)}
                className="text-white/85 font-semibold text-[15px] py-2.5"
              >
                Manage your listing
              </Link>
            )}
            {LEADS_ENABLED && (
              <Link href="/get-quotes" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">
                Get a quote
              </Link>
            )}
            <Link href="/login" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">
              Log in
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="bg-[#ffb400] text-[#0a1722] font-sans font-extrabold text-[15px] px-5 py-3 rounded-xl text-center mt-2"
            >
              Sign up free
            </Link>
            <p className="font-sans text-[12px] text-white/45 text-center mt-2">
              No credit card required · Setup takes 60 seconds
            </p>
          </div>
        )}
      </div>
      {!transparent ? <div className="h-[72px]" aria-hidden /> : null}
    </>
  );
}
