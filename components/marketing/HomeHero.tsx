"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Mic, Crosshair, Send } from "lucide-react";
import ProductShot from "@/components/marketing/ProductShot";

type Scene = {
  key: string;
  image: string;
  alt: string;
  overlay: "markup" | "voice" | "sent";
  label: string;
  objectPos: string;
};

const SCENES: Scene[] = [
  {
    key: "markup",
    image: "/trades/hero-onsite.jpg",
    alt: "Tradie on site with dust mask and ear protection",
    overlay: "markup",
    label: "Live markup",
    objectPos: "object-center",
  },
  {
    key: "voice",
    image: "/trades/carpenter.jpg",
    alt: "Carpenter using a nail gun on site",
    overlay: "voice",
    label: "Voice quote",
    objectPos: "object-[30%_center]",
  },
  {
    key: "sent",
    image: "/trades/electrician.jpg",
    alt: "Electrician installing downlights on a ladder",
    overlay: "sent",
    label: "Sent & accepted",
    objectPos: "object-[40%_center]",
  },
];

const CYCLE_MS = 5200;

/**
 * Mitti-style hero: dark canvas, editorial copy row, then a large media
 * stage with product UI floating on real site photography. Scenes cycle.
 */
export default function HomeHero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduceMotion(true);
    }
  }, []);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SCENES.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [paused, reduceMotion]);

  const scene = SCENES[active];

  return (
    <section
      className="relative bg-[#050b11] pt-24 sm:pt-28"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="max-w-[1280px] mx-auto px-6">
        {/* Editorial copy row: brand dominates, then promise + CTAs */}
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 mb-10 lg:mb-12 home-hero-copy">
          <div className="lg:col-span-7">
            <p className="font-display text-[clamp(2.6rem,7vw,4.8rem)] leading-[0.88] tracking-wide text-white mb-5">
              SWIFTSCOPE
            </p>
            <h1 className="text-[clamp(1.55rem,2.8vw,2.15rem)] font-extrabold leading-[1.2] tracking-[-0.02em] text-white max-w-[22ch]">
              The quoting system for every site, every job, every trade.
            </h1>
          </div>
          <div className="lg:col-span-5 flex flex-col justify-end">
            <p className="text-[15.5px] sm:text-[16px] leading-[1.65] text-[#9eb0bf] mb-7 max-w-[36ch]">
              Built for frontline tradies. Scope it standing in the job, price it from your book, send it before you leave.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center bg-[#ffb400] text-[#050b11] font-extrabold text-[15px] px-6 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors"
              >
                Start free for 7 days
              </Link>
              <Link
                href="/directory"
                className="inline-flex items-center gap-2 text-white font-bold text-[15px] px-5 py-3.5 rounded-lg border border-white/25 hover:border-white/55 transition-colors"
              >
                Find a tradie <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        {/* Media stage: dominant visual with product overlay */}
        <div className="relative">
          <div className="relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-[2.2/1] overflow-hidden rounded-2xl sm:rounded-3xl bg-[#0e2030]">
            {SCENES.map((s, i) => (
              <div
                key={s.key}
                className={[
                  "absolute inset-0 transition-opacity duration-700 ease-out",
                  i === active ? "opacity-100" : "opacity-0",
                ].join(" ")}
                aria-hidden={i !== active}
              >
                <Image
                  src={s.image}
                  alt={s.alt}
                  fill
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  priority={i === 0}
                  quality={90}
                  className={[
                    "object-cover",
                    s.objectPos,
                    i === active && !reduceMotion ? "home-hero-kenburns" : "",
                  ].join(" ")}
                />
              </div>
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />

            {/* Floating product UI */}
            <div className="absolute inset-x-4 bottom-4 sm:inset-auto sm:right-5 sm:bottom-5 sm:left-auto w-auto sm:w-[250px] home-overlay-in" key={scene.key}>
              <ProductOverlay kind={scene.overlay} />
            </div>
          </div>

          {/* Scene tabs */}
          <div className="mt-5 flex flex-wrap gap-6 border-b border-white/10" role="tablist" aria-label="Quote modes">
            {SCENES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={[
                  "relative pb-3 text-[13px] font-bold transition-colors",
                  i === active ? "text-white" : "text-white/45 hover:text-white/75",
                ].join(" ")}
              >
                {s.label}
                {i === active && (
                  <span
                    className={[
                      "absolute bottom-0 left-0 h-[2px] bg-[#ffb400]",
                      reduceMotion ? "w-full" : "home-tab-progress",
                    ].join(" ")}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-10 sm:h-14" />
    </section>
  );
}

function ProductOverlay({ kind }: { kind: Scene["overlay"] }) {
  if (kind === "markup") {
    return (
      <div className="home-glass rounded-2xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <span className="w-7 h-7 rounded-md bg-[#ffb400] flex items-center justify-center">
            <Crosshair size={14} className="text-[#050b11]" aria-hidden />
          </span>
          <div>
            <p className="text-[12px] font-bold text-white leading-tight">Live on-screen markup</p>
            <p className="text-[11px] text-white/50">Tap the zone, price loads</p>
          </div>
        </div>
        <ProductShot
          src="/product/live-camera-markup.webp"
          alt="Marking materials on a live camera view"
          width={1080}
          height={2026}
          sizes="250px"
          className="rounded-[12px]"
        />
        <div className="space-y-1.5 mt-2.5 px-0.5">
          {[
            { label: "Downlights x 8", price: "$940" },
            { label: "Cable run, 12m", price: "$186" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-lg bg-white/8 px-3 py-2">
              <span className="text-[12.5px] font-semibold text-white">{row.label}</span>
              <span className="text-[12.5px] font-bold text-[#ffb400] tabular-nums">{row.price}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "voice") {
    return (
      <div className="home-glass rounded-2xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-full bg-[#ffb400] flex items-center justify-center home-mic-pulse">
            <Mic size={14} className="text-[#050b11]" aria-hidden />
          </span>
          <div>
            <p className="text-[12px] font-bold text-white leading-tight">Listening on site</p>
            <p className="text-[11px] text-white/50">Building quote from voice</p>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed text-white/85 italic mb-3">
          &ldquo;Eight downlights in the living, upgrade the switchboard, two ceiling fans.&rdquo;
        </p>
        <div className="rounded-xl bg-white p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b96a1] mb-1.5">Draft quote</p>
          <p className="text-[26px] font-black text-[#050b11] tabular-nums leading-none mb-2.5">$2,870</p>
          <div className="space-y-1">
            {["Downlights x 8", "Switchboard upgrade", "Ceiling fans x 2"].map((line) => (
              <div key={line} className="flex items-center gap-2 text-[12px] font-semibold text-[#0a1722]">
                <Check size={12} className="text-[#16a34a]" aria-hidden />
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-glass rounded-2xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <span className="w-7 h-7 rounded-md bg-[#16a34a] flex items-center justify-center">
          <Send size={13} className="text-white" aria-hidden />
        </span>
        <div>
          <p className="text-[12px] font-bold text-white leading-tight">Quote sent</p>
          <p className="text-[11px] text-white/50">Client accepted in 47s</p>
        </div>
      </div>
      <ProductShot
        src="/product/quote-send.webp"
        alt="Quote ready to send screen"
        width={1080}
        height={1500}
        fit="cover-top"
        sizes="250px"
        className="rounded-[12px]"
      />
      <div className="rounded-xl bg-[#e8f5ec] px-3.5 py-2.5 flex items-center gap-2 mt-2.5">
        <Check size={15} className="text-[#16a34a]" aria-hidden />
        <p className="text-[12.5px] font-extrabold text-[#1c7a3a]">Accepted, job booked</p>
      </div>
    </div>
  );
}
