"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { LEADS_ENABLED } from "@/lib/featureFlags";

/**
 * Shared top nav for the marketing site (home, /features, /how-it-works).
 * `transparent` is for the homepage hero, where the nav floats over a dark
 * image with no background of its own. Every other page passes false and
 * gets a solid navy bar instead.
 */
export default function MarketingNav({ transparent = false }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);

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
        </div>

        <div className="hidden lg:flex items-center gap-2.5">
          <Link href="/directory" className="text-white/85 hover:text-white font-semibold text-[13.5px] px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 transition-colors">
            Find a tradie
          </Link>
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
          <Link href="/directory" onClick={() => setOpen(false)} className="text-white/85 font-semibold text-[15px] py-2.5">Find a tradie</Link>
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
