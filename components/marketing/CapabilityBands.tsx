import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
  reverse?: boolean;
};

const BANDS: Band[] = [
  {
    kicker: "Quote",
    title: "Price it on the tools.",
    body: "Open the camera, tap the zone, draw the run. Materials and labour load from your book while you are still on site, not from memory at the desk later.",
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
    title: "Send it. They accept.",
    body: "Client opens a clean portal on their phone, taps accept, and the job lands on your board. No PDF chase. No 'did you get my email?'",
    photo: "/trades/new-site.png",
    photoAlt: "Tradie on a residential framing site after winning the job",
    photoPos: "object-[70%_center]",
    shot: "/marketing/v2/phone-quote-send.png",
    shotAlt: "Priced quote ready to send to the client",
    shotW: 325,
    shotH: 658,
    reverse: true,
  },
  {
    kicker: "Manage",
    title: "Run the job from one board.",
    body: "Accepted work becomes a job with schedule, materials, and progress in one place. Built for solo operators and crews up to about 15, not a site office for 200.",
    photo: "/trades/new-carpenter.png",
    photoAlt: "Carpenter framing on a residential interior site",
    photoPos: "object-[center_40%]",
    shot: "/marketing/v2/phone-job-details.png",
    shotAlt: "Job details with scope, cost, and progress",
    shotW: 325,
    shotH: 658,
  },
];

/**
 * Capability sections: sharp residential / small-crew photos with product UI.
 * No chrome box around the phone. Quote → Win → Manage.
 */
export default function CapabilityBands() {
  return (
    <div>
      {BANDS.map((band) => (
        <section key={band.title} className="relative overflow-hidden bg-[#050b11]">
          <div className="relative max-w-[1280px] mx-auto px-6 py-16 lg:py-20">
            <div
              className={[
                "grid lg:grid-cols-12 gap-10 lg:gap-14 items-center",
                band.reverse ? "lg:[direction:rtl]" : "",
              ].join(" ")}
            >
              <div className={["lg:col-span-5", band.reverse ? "lg:[direction:ltr]" : ""].join(" ")}>
                <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
                  {band.kicker}
                </p>
                <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-extrabold tracking-[-0.025em] leading-[1.08] text-white mb-4 max-w-[16ch]">
                  {band.title}
                </h2>
                <p className="text-[16px] leading-[1.65] text-[#c5d4e0] max-w-[42ch] mb-7">
                  {band.body}
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 text-[14px] font-bold text-white hover:text-[#ffb400] transition-colors"
                >
                  Try it free <ArrowRight size={14} aria-hidden />
                </Link>
              </div>

              <div
                className={[
                  "lg:col-span-7 relative",
                  band.reverse ? "lg:[direction:ltr]" : "",
                ].join(" ")}
              >
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
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
