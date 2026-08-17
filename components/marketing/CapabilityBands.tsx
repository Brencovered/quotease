"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Expand } from "lucide-react";
import AccountingLogos from "@/components/marketing/AccountingLogos";
import TrialRiskReversal from "@/components/marketing/TrialRiskReversal";

type Band = {
  kicker: string;
  title: string;
  body: string;
  photo: string;
  photoAlt: string;
  photoPos?: string;
  shot: string;
  shotAlt: string;
  shotW: number;
  shotH: number;
  /** Optional second phone — typically the client-facing quote */
  clientShot?: string;
  clientShotAlt?: string;
  reverse?: boolean;
  showAccounting?: boolean;
};

const BANDS: Band[] = [
  {
    kicker: "Quote",
    title: "Price it on site.",
    body: "Open the camera, tap the zone, draw the run. Materials and labour load from your book while you are still there, not from memory at the desk later.",
    photo: "/trades/new-scaffold.png",
    photoAlt: "Tradie on site scoping a residential job",
    photoPos: "object-[25%_center]",
    shot: "/marketing/v2/phone-plan-drawing.png",
    shotAlt: "Floor plan markup pricing downlights in Swiftscope",
    shotW: 325,
    shotH: 658,
  },
  {
    kicker: "Win",
    title: "They accept. You keep moving.",
    body: "Client opens a clean portal on their phone, taps accept, and the job lands on your board. No PDF chase. No did you get my email.",
    photo: "/trades/new-site.png",
    photoAlt: "Tradie on a residential framing site after winning the job",
    photoPos: "object-[70%_center]",
    shot: "/marketing/v2/phone-quote-send.png",
    shotAlt: "Priced quote ready to send from the tradie phone",
    shotW: 325,
    shotH: 658,
    clientShot: "/marketing/v2/quoting-customer-accepts.png",
    clientShotAlt: "Professional quote summary the homeowner sees and accepts",
    reverse: true,
  },
  {
    kicker: "Manage",
    title: "Run the job from your phone.",
    body: "Accepted work becomes a job with schedule, materials, and progress in one place. Built for solo operators and crews up to about 15, not a site office for 200.",
    photo: "/trades/new-carpenter.png",
    photoAlt: "Carpenter framing on a residential interior site",
    photoPos: "object-[center_40%]",
    shot: "/marketing/v2/phone-job-details.png",
    shotAlt: "Job details with scope, cost, and progress",
    shotW: 325,
    shotH: 658,
    showAccounting: true,
  },
];

/**
 * Capability sections: sharp residential / small-crew photos with product UI.
 * Single CTA per band. Quote → Win → Manage.
 */
export default function CapabilityBands() {
  return (
    <div>
      {BANDS.map((band) => (
        <section key={band.kicker} className="relative overflow-hidden bg-[#1a242c]">
          <div className="relative max-w-[1280px] mx-auto px-6 py-16 lg:py-20">
            <div
              className={[
                "grid lg:grid-cols-12 gap-10 lg:gap-14 items-center",
                band.reverse ? "lg:[direction:rtl]" : "",
              ].join(" ")}
            >
              <div className={["lg:col-span-5", band.reverse ? "lg:[direction:ltr]" : ""].join(" ")}>
                <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
                  {band.kicker}
                </p>
                <h2 className="font-display text-[clamp(1.9rem,4vw,3rem)] tracking-wide leading-[1.05] text-white mb-4 max-w-[18ch]">
                  {band.title}
                </h2>
                <p className="font-sans text-[16px] leading-[1.65] text-[#c5d4e0] max-w-[42ch] mb-7">
                  {band.body}
                </p>
                <div className="flex flex-col items-start gap-2">
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 text-[14px] font-bold text-white hover:text-[#ffb400] transition-colors"
                  >
                    Try it free <ArrowRight size={14} aria-hidden />
                  </Link>
                  <TrialRiskReversal tone="light" />
                </div>
                {band.showAccounting ? (
                  <AccountingLogos tone="dark" className="mt-8" />
                ) : null}
              </div>

              <div
                className={[
                  "lg:col-span-7 relative",
                  band.reverse ? "lg:[direction:ltr]" : "",
                ].join(" ")}
              >
                {band.clientShot ? (
                  <ClientQuotePair
                    photo={band.photo}
                    photoAlt={band.photoAlt}
                    photoPos={band.photoPos}
                    tradieShot={band.shot}
                    tradieAlt={band.shotAlt}
                    clientShot={band.clientShot}
                    clientAlt={band.clientShotAlt ?? "Client quote preview"}
                    shotW={band.shotW}
                    shotH={band.shotH}
                    reverse={band.reverse}
                  />
                ) : (
                  <div className="relative aspect-[4/5] sm:aspect-[16/11] overflow-hidden rounded-2xl sm:rounded-3xl">
                    <Image
                      src={band.photo}
                      alt={band.photoAlt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 640px"
                      quality={90}
                      className={`object-cover ${band.photoPos ?? "object-center"}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
                    <div
                      className={[
                        "absolute top-[7%] bottom-[7%] w-auto",
                        band.reverse ? "left-3 sm:left-5" : "right-3 sm:right-5",
                      ].join(" ")}
                      style={{ aspectRatio: `${band.shotW} / ${band.shotH}` }}
                    >
                      <div className="relative h-full w-full drop-shadow-[0_24px_50px_rgba(0,0,0,0.55)]">
                        <Image
                          src={band.shot}
                          alt={band.shotAlt}
                          fill
                          sizes="(max-width: 640px) 150px, 200px"
                          quality={90}
                          className="object-contain object-bottom"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function ClientQuotePair({
  photo,
  photoAlt,
  photoPos,
  tradieShot,
  tradieAlt,
  clientShot,
  clientAlt,
  shotW,
  shotH,
  reverse,
}: {
  photo: string;
  photoAlt: string;
  photoPos?: string;
  tradieShot: string;
  tradieAlt: string;
  clientShot: string;
  clientAlt: string;
  shotW: number;
  shotH: number;
  reverse?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/5] sm:aspect-[16/11] overflow-hidden rounded-2xl sm:rounded-3xl">
        <Image
          src={photo}
          alt={photoAlt}
          fill
          sizes="(max-width: 1024px) 100vw, 640px"
          quality={90}
          className={`object-cover ${photoPos ?? "object-center"}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />

        {/* Tradie phone */}
        <div
          className={[
            "absolute top-[10%] bottom-[18%] w-auto",
            reverse ? "left-2 sm:left-4" : "right-[38%] sm:right-[40%]",
          ].join(" ")}
          style={{ aspectRatio: `${shotW} / ${shotH}` }}
        >
          <p className="absolute -top-6 left-0 font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-white/70">
            You send
          </p>
          <div className="relative h-full w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)]">
            <Image
              src={tradieShot}
              alt={tradieAlt}
              fill
              sizes="(max-width: 640px) 120px, 170px"
              quality={90}
              className="object-contain object-bottom"
            />
          </div>
        </div>

        {/* Client quote phone */}
        <div
          className={[
            "absolute top-[6%] bottom-[10%] w-auto",
            reverse ? "right-2 sm:right-4" : "right-2 sm:right-4",
          ].join(" ")}
          style={{ aspectRatio: `${shotW} / ${shotH}` }}
        >
          <p className="absolute -top-6 left-0 font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-[#ffb400]">
            They see
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="relative h-full w-full drop-shadow-[0_24px_50px_rgba(0,0,0,0.6)] group text-left"
            aria-label="Expand client quote preview"
          >
            <Image
              src={clientShot}
              alt={clientAlt}
              fill
              sizes="(max-width: 640px) 140px, 190px"
              quality={90}
              className="object-contain object-bottom"
            />
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-black/65 border border-white/20 px-2.5 py-1 font-sans text-[10px] font-bold text-white opacity-90 group-hover:opacity-100">
              <Expand size={11} aria-hidden /> Preview
            </span>
          </button>
        </div>
      </div>

      <p className="font-sans text-[13px] text-white/50 max-w-[48ch]">
        Your phone stays for the job. Theirs gets a clean quote they can accept — so you look premium without a designer PDF.
      </p>

      {expanded ? (
        <div
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Client quote preview"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative w-full max-w-[320px] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={clientShot}
              alt={clientAlt}
              width={shotW}
              height={shotH}
              quality={95}
              className="w-full h-auto drop-shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
            />
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mt-4 w-full font-sans text-[14px] font-bold text-white/80 hover:text-white"
            >
              Close preview
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
