"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Briefcase, Crosshair, Trophy } from "lucide-react";

type Scene = {
  key: string;
  image: string;
  alt: string;
  label: string;
  blurb: string;
  chip: string;
  objectPos: string;
  icon: ReactNode;
  phone: string;
  phoneAlt: string;
};

const SCENES: Scene[] = [
  {
    key: "quote",
    image: "/trades/new-electrician.png",
    alt: "Tradie on a residential site scoping the job",
    label: "Quote",
    blurb: "Mark it up on the tools",
    chip: "Live site markup",
    objectPos: "object-left",
    icon: <Crosshair size={18} aria-hidden />,
    phone: "/marketing/v2/phone-quote.png",
    phoneAlt: "Quote capture with live site markup in Swiftscope",
  },
  {
    key: "win",
    image: "/trades/new-roofer.png",
    alt: "Tradie on a residential build after winning the job",
    label: "Win",
    blurb: "Send it. Get the yes.",
    chip: "Quote ready to send",
    objectPos: "object-left",
    icon: <Trophy size={18} aria-hidden />,
    phone: "/marketing/v2/phone-quote-send.png",
    phoneAlt: "Priced quote ready to send to the client",
  },
  {
    key: "manage",
    image: "/trades/new-internal-site.png",
    alt: "Residential interior construction site with a worker on the tools",
    label: "Manage",
    blurb: "Run the job from one board",
    chip: "Job board live",
    objectPos: "object-center",
    icon: <Briefcase size={18} aria-hidden />,
    phone: "/marketing/v2/phone-job-management.png",
    phoneAlt: "Job management with progress and timeline",
  },
];

const CYCLE_MS = 5200;
const PHONE_W = 325;
const PHONE_H = 658;

/**
 * Mitti-style hero: dark canvas, editorial copy, media stage with floating
 * product UI, and an animated Quote → Win → Manage cycle.
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
      className="relative bg-[#050b11] pt-24 sm:pt-28 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Soft atmospheric wash — not a glow stack */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 85% 10%, rgba(255,180,0,0.10), transparent 55%), radial-gradient(ellipse 60% 40% at 10% 30%, rgba(14,32,48,0.9), transparent 60%)",
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-5 sm:px-6">
        <div className="grid lg:grid-cols-12 gap-5 lg:gap-10 mb-7 sm:mb-10 lg:mb-12 home-hero-copy">
          <div className="lg:col-span-7">
            <p className="font-display text-[clamp(2.4rem,8vw,4.8rem)] leading-[0.88] tracking-wide text-white mb-3 sm:mb-5">
              SwiftScope
            </p>
            <h1 className="font-display text-[clamp(1.55rem,4.2vw,2.55rem)] leading-[1.05] tracking-wide text-white max-w-[18ch]">
              <span className="text-[#ffb400]">Scope</span> it.{" "}
              <span className="text-[#ffb400]">Quote</span> it.
              <br />
              <span className="text-[#ffb400]">Win</span> it on site.
            </h1>
          </div>
          <div className="lg:col-span-5 flex flex-col justify-end">
            <p className="font-sans text-[14.5px] sm:text-[16px] leading-[1.6] text-[#9eb0bf] mb-5 sm:mb-7 max-w-[42ch]">
              <span className="sm:hidden">
                Built site-first. Mark it up, talk it through, or scope it live, then send a priced quote before you leave the driveway.
              </span>
              <span className="hidden sm:inline">
                Swiftscope is built site-first - every tool is designed to be used standing in the job, not back at a desk. Mark it up, talk it through, or scope it live on screen, and send a priced quote before you&apos;ve left the driveway.
              </span>
            </p>
            <div className="flex flex-wrap gap-2.5 sm:gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center bg-[#ffb400] text-[#050b11] font-extrabold text-[14px] sm:text-[15px] px-5 sm:px-6 py-3 sm:py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors"
              >
                Start free for 7 days
              </Link>
              <Link
                href="/directory"
                className="inline-flex items-center gap-2 text-white font-bold text-[14px] sm:text-[15px] px-4 sm:px-5 py-3 sm:py-3.5 rounded-lg border border-white/25 hover:border-white/55 transition-colors"
              >
                Find a tradie <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="relative aspect-[5/6] sm:aspect-[16/10] lg:aspect-[2.15/1] overflow-hidden rounded-2xl sm:rounded-3xl bg-[#0e2030] home-media-stage">
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
            <div className="absolute inset-0 bg-gradient-to-l from-black/45 via-black/10 to-transparent" />

            {/* Giant step index — editorial energy */}
            <p
              key={`n-${scene.key}`}
              aria-hidden
              className="pointer-events-none absolute left-3 sm:left-6 bottom-2 sm:bottom-4 font-display text-[clamp(4.5rem,18vw,9rem)] leading-none tracking-wide text-white/[0.08] home-overlay-in"
            >
              0{active + 1}
            </p>

            {/* Scene chip */}
            <div
              key={`chip-${scene.key}`}
              className="absolute left-3 top-3 sm:left-5 sm:top-5 home-overlay-in"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-black/45 border border-white/15 backdrop-blur-md px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ffb400] home-dot-pulse" />
                <span className="font-sans text-[11px] sm:text-[12px] font-bold text-white">
                  <span className="text-[#ffb400]">{scene.label}</span>
                  <span className="text-white/45"> · </span>
                  {scene.chip}
                </span>
              </div>
            </div>

            {/* Phone — smaller on mobile so the photo can breathe */}
            <div
              key={scene.key}
              className={[
                "absolute right-2.5 top-1/2 -translate-y-1/2 home-overlay-in",
                "h-[68%] sm:h-[84%] sm:right-5 lg:right-8",
                !reduceMotion ? "home-phone-float" : "",
              ].join(" ")}
              style={{ aspectRatio: `${PHONE_W} / ${PHONE_H}` }}
            >
              <div className="relative h-full w-full drop-shadow-[0_24px_55px_rgba(0,0,0,0.6)]">
                <Image
                  src={scene.phone}
                  alt={scene.phoneAlt}
                  fill
                  sizes="(max-width: 640px) 140px, 210px"
                  quality={90}
                  className="object-contain"
                />
              </div>
            </div>
          </div>

          {/* Mobile: compact horizontal steps. Desktop: richer cards. */}
          <div
            className="mt-4 sm:mt-5 grid grid-cols-3 gap-2 sm:gap-3"
            role="tablist"
            aria-label="How Swiftscope works"
          >
            {SCENES.map((s, i) => {
              const selected = i === active;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(i)}
                  className={[
                    "relative text-left rounded-xl sm:rounded-2xl border transition-all duration-300 overflow-hidden",
                    "px-2.5 py-2.5 sm:px-4 sm:py-3.5",
                    selected
                      ? "bg-white/[0.09] border-[#ffb400]/80 shadow-[0_10px_30px_rgba(255,180,0,0.08)] scale-[1.02]"
                      : "bg-white/[0.02] border-white/10 hover:border-white/30 hover:bg-white/[0.05]",
                  ].join(" ")}
                >
                  <div className="flex items-center sm:items-start gap-2 sm:gap-3">
                    <span
                      className={[
                        "w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        selected ? "bg-[#ffb400] text-[#050b11]" : "bg-white/8 text-white/70",
                        selected && !reduceMotion ? "home-icon-pop" : "",
                      ].join(" ")}
                    >
                      {s.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span
                          className={[
                            "hidden sm:inline text-[11px] font-bold tracking-[0.14em] uppercase",
                            selected ? "text-[#ffb400]" : "text-white/35",
                          ].join(" ")}
                        >
                          0{i + 1}
                        </span>
                        <span
                          className={[
                            "font-display text-[14px] sm:text-[16px] tracking-wide truncate",
                            selected ? "text-white" : "text-white/55",
                          ].join(" ")}
                        >
                          {s.label}
                        </span>
                      </div>
                      <p
                        className={[
                          "hidden sm:block font-sans text-[13px] leading-snug mt-0.5",
                          selected ? "text-[#c5d4e0]" : "text-white/40",
                        ].join(" ")}
                      >
                        {s.blurb}
                      </p>
                    </div>
                  </div>
                  {selected && (
                    <span
                      className={[
                        "absolute left-0 bottom-0 h-[2px] bg-[#ffb400]",
                        reduceMotion ? "w-full" : "home-tab-progress",
                      ].join(" ")}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="h-8 sm:h-14" />
    </section>
  );
}
