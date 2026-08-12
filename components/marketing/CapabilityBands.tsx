import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Band = {
  kicker: string;
  title: string;
  body: string;
  photo: string;
  photoAlt: string;
  shot: string;
  shotAlt: string;
  reverse?: boolean;
};

const BANDS: Band[] = [
  {
    kicker: "On the tools",
    title: "Mark the job. Watch it price.",
    body: "Open the camera, tap the zone, draw the run. Materials and labour load from your book — not from memory at the desk later.",
    photo: "/trades/electrician.jpg",
    photoAlt: "Electrician working on a residential site",
    shot: "/product/live-camera-markup.webp",
    shotAlt: "Live camera markup in Swiftscope",
  },
  {
    kicker: "Voice quoting",
    title: "Talk the walk. Get a draft.",
    body: "Walk the job and describe the work. Swiftscope turns it into a priced quote with your rates. Or record it on the drive home.",
    photo: "/trades/plumber.jpg",
    photoAlt: "Plumber on a residential job",
    shot: "/product/quote-capture.webp",
    shotAlt: "Quote capture after voice note",
    reverse: true,
  },
  {
    kicker: "Plans",
    title: "Same plan. Priced, not guessed.",
    body: "Upload a drawing, drop markers, block zones. Every markup becomes a line with quantity and cost already on it.",
    photo: "/trades/carpenter.jpg",
    photoAlt: "Carpenter measuring timber on site",
    shot: "/product/plan-markup.webp",
    shotAlt: "Plan markup with priced markers",
  },
];

export default function CapabilityBands() {
  return (
    <div>
      {BANDS.map((band) => (
        <section key={band.title} className="relative min-h-[78vh] flex items-end overflow-hidden bg-[#071018]">
          <div className="absolute inset-0">
            <Image
              src={band.photo}
              alt={band.photoAlt}
              fill
              sizes="100vw"
              className="object-cover object-center"
            />
            <div
              className={[
                "absolute inset-0",
                band.reverse
                  ? "bg-gradient-to-l from-[#071018] via-[#071018]/75 to-[#071018]/20"
                  : "bg-gradient-to-r from-[#071018] via-[#071018]/75 to-[#071018]/20",
              ].join(" ")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#071018] via-transparent to-[#071018]/35" />
          </div>

          <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 py-16 lg:py-20">
            <div
              className={[
                "grid lg:grid-cols-12 gap-10 items-end",
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
                <p className="text-[16px] leading-[1.65] text-[#b7c7d4] max-w-[42ch] mb-7">
                  {band.body}
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 text-[14px] font-bold text-white hover:text-[#ffb400] transition-colors"
                >
                  Try it free <ArrowRight size={14} aria-hidden />
                </Link>
              </div>

              <div className={["lg:col-span-6 flex", band.reverse ? "lg:justify-start lg:[direction:ltr]" : "lg:justify-end"].join(" ")}>
                <div className="w-full max-w-[340px] home-glass rounded-2xl p-3 shadow-[0_28px_70px_rgba(0,0,0,0.5)]">
                  <div className="relative aspect-[9/16] max-h-[460px] rounded-xl overflow-hidden bg-[#0e2030]">
                    <Image
                      src={band.shot}
                      alt={band.shotAlt}
                      fill
                      sizes="340px"
                      className="object-cover object-top"
                    />
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
