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
    blurb: "Price it on the tools",
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
    blurb: "Send it. Get accepted.",
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
 * Mitti-style hero: dark canvas, editorial copy row, then a large media
 * stage with product UI floating on real site photography.
 * Scenes follow Quote → Win → Manage for solo and small crews.
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
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 mb-10 lg:mb-12 home-hero-copy">
          <div className="lg:col-span-7">
            <p className="font-display text-[clamp(2.6rem,7vw,4.8rem)] leading-[0.88] tracking-wide text-white mb-5">
              SwiftScope
            </p>
            <h1 className="font-display text-[clamp(1.7rem,3.4vw,2.55rem)] leading-[1.05] tracking-wide text-white max-w-[18ch]">
              <span className="text-[#ffb400]">Scope</span> it.{" "}
              <span className="text-[#ffb400]">Quote</span> it.
              <br />
              <span className="text-[#ffb400]">Win</span> it on site.
            </h1>
          </div>
          <div className="lg:col-span-5 flex flex-col justify-end">
            <p className="font-sans text-[15.5px] sm:text-[16px] leading-[1.65] text-[#9eb0bf] mb-7 max-w-[42ch]">
              Swiftscope is built site-first - every tool is designed to be used standing in the job, not back at a desk. Mark it up, talk it through, or scope it live on screen, and send a priced quote before you&apos;ve left the driveway.
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

        <div className="relative">
          {/* Photo stage: overflow clipped. Phone sits in a height-capped slot so it never cuts off. */}
          <div className="relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-[2.15/1] overflow-hidden rounded-2xl sm:rounded-3xl bg-[#0e2030]">
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-l from-black/35 via-transparent to-transparent" />

            <div
              key={scene.key}
              className="absolute top-[7%] bottom-[7%] right-3 sm:right-5 lg:right-8 home-overlay-in"
              style={{ aspectRatio: `${PHONE_W} / ${PHONE_H}` }}
            >
              <div className="relative h-full w-full drop-shadow-[0_24px_55px_rgba(0,0,0,0.6)]">
                <Image
                  src={scene.phone}
                  alt={scene.phoneAlt}
                  fill
                  sizes="(max-width: 640px) 160px, 220px"
                  quality={90}
                  className="object-contain"
                />
              </div>
            </div>
          </div>

          <div
            className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3"
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
                    "relative text-left rounded-2xl border px-4 py-3.5 transition-all duration-300",
                    selected
                      ? "bg-white/[0.07] border-[#ffb400]/70 shadow-[0_0_0_1px_rgba(255,180,0,0.15)]"
                      : "bg-white/[0.02] border-white/10 hover:border-white/25 hover:bg-white/[0.04]",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={[
                        "mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        selected ? "bg-[#ffb400] text-[#050b11]" : "bg-white/8 text-white/70",
                      ].join(" ")}
                    >
                      {s.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={[
                            "text-[11px] font-bold tracking-[0.14em] uppercase",
                            selected ? "text-[#ffb400]" : "text-white/35",
                          ].join(" ")}
                        >
                          0{i + 1}
                        </span>
                        <span
                          className={[
                            "font-display text-[16px] tracking-wide",
                            selected ? "text-white" : "text-white/55",
                          ].join(" ")}
                        >
                          {s.label}
                        </span>
                      </div>
                      <p
                        className={[
                          "font-sans text-[13px] leading-snug",
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
                        "absolute left-4 bottom-0 h-[2px] bg-[#ffb400] rounded-full",
                        reduceMotion ? "w-[calc(100%-2rem)]" : "home-tab-progress",
                      ].join(" ")}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="h-10 sm:h-14" />
    </section>
  );
}
