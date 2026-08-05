"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import { LEADS_ENABLED, CLAIMED_DIRECTORY_PAGES_ENABLED } from "@/lib/featureFlags";
import { TRADE_PAGES } from "@/lib/marketing/tradePages";

/**
 * Shared top nav for the marketing site (home, /features, /how-it-works).
 * `transparent` is for the homepage hero, where the nav floats over a dark
 * image with no background of its own. Every other page passes false and
 * gets a solid navy bar instead.
 *
 * Trades is a dropdown rather than a link because there is no index page
 * at /quoting-software: the six trade pages are the destination, and a
 * menu gets a visitor to their own trade in one click instead of two.
 * It reads TRADE_PAGES directly, so adding a trade adds a menu item.
 */
export default function MarketingNav({ transparent = false }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const tradesRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className={transparent ? "absolute top-0 left-0 right-0 z-30" : "relative z-30 bg-[#0a1722]"}>
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="font-display text-xl tracking-wide text-white drop-shadow-lg shrink-0">
          SWIFTSCOPE
        </Link>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-7">
          <Link href="/features" className="text-white/75 hover:text-white font-semibold text-sm transition-colors">Features</Link>
          <Link href="/how-it-works" className="text-white/75 hover:text-white font-semibold text-sm transition-colors">How it works</Link>
          <Link href="/blog" className="text-white/75 hover:text-white font-semibold text-sm transition-colors">Blog</Link>

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
              // pt-2 on the panel keeps a hoverable bridge between button
              // and menu, so the pointer does not cross a dead gap and
              // close it on the way down.
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
        </div>

        <div className="hidden lg:flex items-center gap-2.5">
          <Link href="/directory" className="text-white/85 hover:text-white font-semibold text-[13.5px] px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 transition-colors">
            Find a tradie
          </Link>
          {CLAIMED_DIRECTORY_PAGES_ENABLED && (
            <Link href="/directory/claim" className="text-white/85 hover:text-white font-semibold text-[13.5px] px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 transition-colors">
              Manage your listing
            </Link>
          )}
          {LEADS_ENABLED && (
            <Link href="/get-quotes" className="text-white/85 hover:text-white font-semibold text-[13.5px] px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 transition-colors">
              Get a quote
            </Link>
          )}
          <Link href="/login" className="text-white/75 hover:text-white font-semibold text-[13.5px] px-3 py-2 transition-colors">
            Log in
          </Link>
          <Link href="/signup" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[13.5px] px-5 py-2.5 rounded-xl hover:bg-[#e89e00] transition-colors">
            Sign up free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen((v) => !v)} className="lg:hidden text-white p-1" aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden bg-[#0a1722] border-t border-white/10 px-6 py-5 flex flex-col gap-1">
          <Link href="/features" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">Features</Link>
          <Link href="/how-it-works" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">How it works</Link>
          <Link href="/blog" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">Blog</Link>

          {/* Listed flat rather than behind a second tap: a tradie opening
              this menu is looking for their own trade, and burying it
              costs more than the extra height. */}
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] pt-4 pb-1">Trades</p>
          {TRADE_PAGES.map((t) => (
            <Link
              key={t.slug}
              href={`/quoting-software/${t.slug}`}
              onClick={() => setOpen(false)}
              className="text-white/75 font-semibold text-[14.5px] py-2 pl-3 border-l border-white/15"
            >
              Quoting software for {t.trade}
            </Link>
          ))}

          <div className="h-px bg-white/10 my-3" />
          <Link href="/directory" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">Find a tradie</Link>
          {CLAIMED_DIRECTORY_PAGES_ENABLED && (
            <Link href="/directory/claim" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">Manage your listing</Link>
          )}
          {LEADS_ENABLED && (
            <Link href="/get-quotes" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">Get a quote</Link>
          )}
          <Link href="/login" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">Log in</Link>
          <Link href="/signup" onClick={() => setOpen(false)} className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-5 py-3 rounded-xl text-center mt-2">
            Sign up free
          </Link>
        </div>
      )}
    </div>
  );
}
