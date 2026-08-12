"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Mic, Crosshair, Send } from "lucide-react";

type Scene = {
  key: string;
  image: string;
  alt: string;
  blur: string;
  overlay: "markup" | "voice" | "sent";
  label: string;
};

const SCENES: Scene[] = [
  {
    key: "markup",
    image: "/trades/hero-onsite.jpg",
    alt: "Tradie on site cutting with dust mask and ear protection",
    blur:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAJABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBAm6IL0JFQ/ZZYFZ7jhO1aZ+9HTtd/5Bq/WmJWP//Z",
    overlay: "markup",
    label: "Live markup",
  },
  {
    key: "voice",
    image: "/trades/electrician.jpg",
    alt: "Electrician working on site",
    blur:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAJABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBAm6IL0JFQ/ZZYFZ7jhO1aZ+9HTtd/5Bq/WmJWP//Z",
    overlay: "voice",
    label: "Voice quote",
  },
  {
    key: "sent",
    image: "/trades/plumber.jpg",
    alt: "Plumber on a residential job",
    blur:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAJABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBAm6IL0JFQ/ZZYFZ7jhO1aZ+9HTtd/5Bq/WmJWP//Z",
    overlay: "sent",
    label: "Sent & accepted",
  },
];

const CYCLE_MS = 5200;

/**
 * Homepage hero: full-bleed site photography with a cycling product overlay.
 * Pattern borrowed from mitti.com — product UI lives on the job, not in a
 * detached screenshot gallery.
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
      className="relative min-h-[100svh] flex flex-col bg-[#071018]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Full-bleed photo plane */}
      <div className="absolute inset-0 z-0">
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
              sizes="100vw"
              priority={i === 0}
              placeholder="blur"
              blurDataURL={s.blur}
              className={[
                "object-cover object-center",
                i === active && !reduceMotion ? "home-hero-kenburns" : "",
              ].join(" ")}
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-[#071018] via-[#071018]/78 to-[#071018]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071018] via-transparent to-[#071018]/45" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-[1280px] mx-auto px-6 pt-28 pb-16 lg:pt-32 lg:pb-20">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-end">
              {/* Copy — brand first, then one headline + sentence + CTAs */}
              <div className="lg:col-span-6 home-hero-copy">
                <p className="font-display text-[clamp(2.8rem,8vw,5.5rem)] leading-[0.86] tracking-wide text-white mb-6">
                  SWIFTSCOPE
                </p>
                <h1 className="text-[clamp(1.65rem,3.4vw,2.35rem)] font-extrabold leading-[1.15] text-white tracking-[-0.02em] mb-5 max-w-[18ch]">
                  The quoting system for every site, every job, every trade.
                </h1>
                <p className="text-[16px] sm:text-[17px] leading-[1.6] text-[#b7c7d4] max-w-[38ch] mb-9">
                  Built for frontline tradies. Scope it standing in the job, price it from your book, send it before you leave.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center bg-[#ffb400] text-[#071018] font-extrabold text-[15px] px-7 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors"
                  >
                    Start free for 7 days
                  </Link>
                  <Link
                    href="/directory"
                    className="inline-flex items-center gap-2 text-white font-bold text-[15px] px-6 py-3.5 rounded-lg border border-white/30 hover:border-white/60 transition-colors"
                  >
                    Find a tradie <ArrowRight size={15} aria-hidden />
                  </Link>
                </div>
              </div>

              {/* Floating product UI — part of the visual plane */}
              <div className="lg:col-span-6 flex lg:justify-end">
                <div className="w-full max-w-[380px] home-overlay-in" key={scene.key}>
                  <ProductOverlay kind={scene.overlay} />
                </div>
              </div>
            </div>

            {/* Scene picker — interaction, not decoration */}
            <div className="mt-12 flex flex-wrap gap-2" role="tablist" aria-label="Quote modes">
              {SCENES.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => setActive(i)}
                  className={[
                    "relative overflow-hidden rounded-full px-4 py-2 text-[12.5px] font-bold transition-colors",
                    i === active
                      ? "bg-white text-[#071018]"
                      : "bg-white/10 text-white/80 hover:bg-white/18",
                  ].join(" ")}
                >
                  {s.label}
                  {i === active && !reduceMotion && (
                    <span className="absolute bottom-0 left-0 h-[2px] bg-[#ffb400] home-tab-progress" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductOverlay({ kind }: { kind: Scene["overlay"] }) {
  if (kind === "markup") {
    return (
      <div className="home-glass rounded-2xl p-4 sm:p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-8 h-8 rounded-lg bg-[#ffb400] flex items-center justify-center">
            <Crosshair size={15} className="text-[#071018]" aria-hidden />
          </span>
          <div>
            <p className="text-[12px] font-bold text-white">Live on-screen markup</p>
            <p className="text-[11px] text-white/55">Tap the zone · price loads</p>
          </div>
        </div>
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#0e2030] mb-4">
          <Image
            src="/product/live-camera-markup.webp"
            alt="Marking materials on a live camera view"
            fill
            sizes="360px"
            className="object-cover object-top"
          />
        </div>
        <div className="space-y-2">
          {[
            { label: "Downlights × 8", price: "$940" },
            { label: "Cable run · 12m", price: "$186" },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-lg bg-white/8 px-3 py-2.5"
            >
              <span className="text-[13px] font-semibold text-white">{row.label}</span>
              <span className="text-[13px] font-bold text-[#ffb400] tabular-nums">{row.price}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "voice") {
    return (
      <div className="home-glass rounded-2xl p-4 sm:p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-8 h-8 rounded-full bg-[#ffb400] flex items-center justify-center home-mic-pulse">
            <Mic size={15} className="text-[#071018]" aria-hidden />
          </span>
          <div>
            <p className="text-[12px] font-bold text-white">Listening on site</p>
            <p className="text-[11px] text-white/55">Building quote from voice</p>
          </div>
        </div>
        <p className="text-[14px] leading-relaxed text-white/85 italic mb-4">
          &ldquo;Eight downlights in the living, upgrade the switchboard, and two ceiling fans in the bedrooms.&rdquo;
        </p>
        <div className="rounded-xl bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b96a1] mb-2">Draft quote</p>
          <p className="text-[28px] font-black text-[#071018] tabular-nums leading-none mb-3">$2,870</p>
          <div className="space-y-1.5">
            {["Downlights × 8", "Switchboard upgrade", "Ceiling fans × 2"].map((line) => (
              <div key={line} className="flex items-center gap-2 text-[12.5px] font-semibold text-[#0a1722]">
                <Check size={13} className="text-[#16a34a]" aria-hidden />
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-glass rounded-2xl p-4 sm:p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg bg-[#16a34a] flex items-center justify-center">
          <Send size={14} className="text-white" aria-hidden />
        </span>
        <div>
          <p className="text-[12px] font-bold text-white">Quote sent</p>
          <p className="text-[11px] text-white/55">Client accepted in 47s</p>
        </div>
      </div>
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#0e2030] mb-4">
        <Image
          src="/product/quote-send.webp"
          alt="Quote ready to send screen"
          fill
          sizes="360px"
          className="object-cover object-top"
        />
      </div>
      <div className="rounded-xl bg-[#e8f5ec] px-4 py-3 flex items-center gap-2">
        <Check size={16} className="text-[#16a34a]" aria-hidden />
        <p className="text-[13px] font-extrabold text-[#1c7a3a]">Accepted · job booked</p>
      </div>
    </div>
  );
}
