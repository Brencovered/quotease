import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductShot from "@/components/marketing/ProductShot";

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
    photo: "/trades/scene-quote.jpg",
    photoAlt: "Solo electrician working on a residential board",
    photoPos: "object-[30%_center]",
    shot: "/product/quote-capture.webp",
    shotAlt: "Quote capture options in Swiftscope",
    shotW: 718,
    shotH: 1474,
  },
  {
    kicker: "Win",
    title: "Send it. They accept.",
    body: "Client opens a clean portal on their phone, taps accept, and the job lands on your board. No PDF chase. No 'did you get my email?'",
    photo: "/trades/scene-win.jpg",
    photoAlt: "Finished residential kitchen after a won job",
    photoPos: "object-center",
    shot: "/product/quote-send.webp",
    shotAlt: "Priced quote ready to send",
    shotW: 714,
    shotH: 1474,
    reverse: true,
  },
  {
    kicker: "Manage",
    title: "Run the job from one board.",
    body: "Accepted work becomes a job with schedule, materials, and progress in one place. Built for solo operators and crews up to about 15, not a site office for 200.",
    photo: "/trades/scene-manage.jpg",
    photoAlt: "Trade tools organised for the next scheduled job",
    photoPos: "object-center",
    shot: "/marketing/v2/schedule-phone.png",
    shotAlt: "Job schedule in Swiftscope",
    shotW: 856,
    shotH: 1720,
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
          <div className="absolute inset-0">
            <Image
              src={band.photo}
              alt=""
              fill
              sizes="100vw"
              quality={88}
              className={`object-cover ${band.photoPos ?? "object-center"}`}
            />
            <div className="absolute inset-0 bg-[#050b11]/78" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050b11] via-[#050b11]/85 to-[#050b11]/55" />
          </div>

          <div className="relative max-w-[1280px] mx-auto px-6 py-16 lg:py-20">
            <div
              className={[
                "grid lg:grid-cols-12 gap-10 lg:gap-14 items-center",
                band.reverse ? "lg:[direction:rtl]" : "",
              ].join(" ")}
            >
              <div className={["lg:col-span-6", band.reverse ? "lg:[direction:ltr]" : ""].join(" ")}>
                <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
                  {band.kicker}
                </p>
                <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-extrabold tracking-[-0.025em] leading-[1.08] text-white mb-4 max-w-[16ch]">
                  {band.title}
                </h2>
                <p className="text-[16px] leading-[1.65] text-[#d0dde8] max-w-[42ch] mb-7">
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
                  "lg:col-span-6 flex",
                  band.reverse ? "lg:justify-start lg:[direction:ltr]" : "lg:justify-end",
                ].join(" ")}
              >
                <div className="w-full max-w-[260px] drop-shadow-[0_24px_50px_rgba(0,0,0,0.45)]">
                  <ProductShot
                    src={band.shot}
                    alt={band.shotAlt}
                    width={band.shotW}
                    height={band.shotH}
                    sizes="260px"
                    className="rounded-[22px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
