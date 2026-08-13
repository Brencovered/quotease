"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Crosshair, Briefcase, Trophy } from "lucide-react";
import ProductShot from "@/components/marketing/ProductShot";

type Scene = {
  key: string;
  image: string;
  alt: string;
  overlay: "quote" | "win" | "manage";
  label: string;
  objectPos: string;
};

const SCENES: Scene[] = [
  {
    key: "quote",
    image: "/trades/new-electrician.png",
    alt: "Tradie on a residential site scoping the job",
    overlay: "quote",
    label: "Quote",
    objectPos: "object-left",
  },
  {
    key: "win",
    image: "/trades/new-roofer.png",
    alt: "Tradie on a residential build after winning the job",
    overlay: "win",
    label: "Win",
    objectPos: "object-left",
  },
  {
    key: "manage",
    image: "/trades/new-internal-site.png",
    alt: "Residential interior construction site with a worker on the tools",
    overlay: "manage",
    label: "Manage",
    objectPos: "object-center",
  },
];

const CYCLE_MS = 5200;

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
              SWIFTSCOPE
            </p>
            <h1 className="text-[clamp(1.55rem,2.8vw,2.15rem)] font-extrabold leading-[1.2] tracking-[-0.02em] text-white max-w-[24ch]">
              Quote on site. Win the job. Manage the crew.
            </h1>
          </div>
          <div className="lg:col-span-5 flex flex-col justify-end">
            <p className="text-[15.5px] sm:text-[16px] leading-[1.65] text-[#9eb0bf] mb-7 max-w-[38ch]">
              Built for solo tradies and small teams up to about 15. Scope it on the tools, send it before you leave, run the job from one board.
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
          <div className="relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-[2.2/1] overflow-hidden rounded-2xl sm:rounded-3xl bg-[#0e2030]">
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15" />

            <div
              className="absolute right-3 bottom-3 w-[46%] max-w-[168px] sm:right-5 sm:bottom-5 sm:w-[250px] sm:max-w-none home-overlay-in"
              key={scene.key}
            >
              <ProductOverlay kind={scene.overlay} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-6 border-b border-white/10" role="tablist" aria-label="How Swiftscope works">
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

const PHONE_W = 325;
const PHONE_H = 658;

function ProductOverlay({ kind }: { kind: Scene["overlay"] }) {
  if (kind === "quote") {
    return (
      <div className="drop-shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
        <div className="hidden sm:flex items-center gap-2 mb-2.5 px-1 home-glass rounded-xl p-2">
          <span className="w-7 h-7 rounded-md bg-[#ffb400] flex items-center justify-center">
            <Crosshair size={14} className="text-[#050b11]" aria-hidden />
          </span>
          <div>
            <p className="text-[12px] font-bold text-white leading-tight">Quote on the tools</p>
            <p className="text-[11px] text-white/50">Tap the zone, price loads</p>
          </div>
        </div>
        <ProductShot
          src="/marketing/v2/phone-quote.png"
          alt="Quote capture with live site markup in Swiftscope"
          width={PHONE_W}
          height={PHONE_H}
          sizes="(max-width: 640px) 168px, 250px"
        />
        <div className="hidden sm:block space-y-1.5 mt-2.5 home-glass rounded-xl p-2">
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

  if (kind === "win") {
    return (
      <div className="drop-shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
        <div className="hidden sm:flex items-center gap-2 mb-2.5 px-1 home-glass rounded-xl p-2">
          <span className="w-7 h-7 rounded-md bg-[#16a34a] flex items-center justify-center">
            <Trophy size={13} className="text-white" aria-hidden />
          </span>
          <div>
            <p className="text-[12px] font-bold text-white leading-tight">Send and win</p>
            <p className="text-[11px] text-white/50">Quote ready for the client</p>
          </div>
        </div>
        <ProductShot
          src="/marketing/v2/phone-quote-send.png"
          alt="Priced quote ready to send to the client"
          width={PHONE_W}
          height={PHONE_H}
          sizes="(max-width: 640px) 168px, 250px"
        />
        <div className="hidden sm:flex rounded-xl bg-[#e8f5ec] px-3.5 py-2.5 items-center gap-2 mt-2.5">
          <Check size={15} className="text-[#16a34a]" aria-hidden />
          <p className="text-[12.5px] font-extrabold text-[#1c7a3a]">Send quote to client</p>
        </div>
      </div>
    );
  }

  return (
    <div className="drop-shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
      <div className="hidden sm:flex items-center gap-2 mb-2.5 px-1 home-glass rounded-xl p-2">
        <span className="w-7 h-7 rounded-md bg-[#ffb400] flex items-center justify-center">
          <Briefcase size={13} className="text-[#050b11]" aria-hidden />
        </span>
        <div>
          <p className="text-[12px] font-bold text-white leading-tight">Manage the job</p>
          <p className="text-[11px] text-white/50">Progress, tasks, timeline</p>
        </div>
      </div>
      <ProductShot
        src="/marketing/v2/phone-job-management.png"
        alt="Job management with progress and timeline"
        width={PHONE_W}
        height={PHONE_H}
        sizes="(max-width: 640px) 168px, 250px"
      />
      <div className="hidden sm:block space-y-1.5 mt-2.5 home-glass rounded-xl p-2">
        {[
          { label: "Living room lights", status: "Today" },
          { label: "Switchboard upgrade", status: "Thu" },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-lg bg-white/8 px-3 py-2">
            <span className="text-[12.5px] font-semibold text-white">{row.label}</span>
            <span className="text-[11.5px] font-bold text-[#ffb400]">{row.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
