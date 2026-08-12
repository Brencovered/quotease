import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductShot from "@/components/marketing/ProductShot";

type Band = {
  kicker: string;
  title: string;
  body: string;
  shot: string;
  shotAlt: string;
  shotW: number;
  shotH: number;
  reverse?: boolean;
};

const BANDS: Band[] = [
  {
    kicker: "On the tools",
    title: "Mark the job. Watch it price.",
    body: "Open the camera, tap the zone, draw the run. Materials and labour load from your book, not from memory at the desk later.",
    shot: "/product/quote-capture.webp",
    shotAlt: "Quote capture options in Swiftscope",
    shotW: 718,
    shotH: 1474,
  },
  {
    kicker: "Voice quoting",
    title: "Talk the walk. Get a draft.",
    body: "Walk the job and describe the work. Swiftscope turns it into a priced quote with your rates. Or record it on the drive home.",
    shot: "/product/quote-send.webp",
    shotAlt: "Priced quote ready to send",
    shotW: 714,
    shotH: 1474,
    reverse: true,
  },
  {
    kicker: "Plans",
    title: "Same plan. Priced, not guessed.",
    body: "Upload a drawing, drop markers, block zones. Every markup becomes a line with quantity and cost already on it.",
    shot: "/product/plan-markup.webp",
    shotAlt: "Plan markup with priced markers",
    shotW: 600,
    shotH: 1330,
  },
];

/**
 * Capability sections: phone only on a dark canvas.
 * Soft trade photo backgrounds were reading as blur and visual noise.
 */
export default function CapabilityBands() {
  return (
    <div>
      {BANDS.map((band) => (
        <section key={band.title} className="bg-[#050b11]">
          <div className="max-w-[1280px] mx-auto px-6 py-16 lg:py-20">
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
                <div className="w-full max-w-[280px]">
                  <div className="rounded-[22px] bg-[#1a2a38] p-2 ring-1 ring-white/10">
                    <ProductShot
                      src={band.shot}
                      alt={band.shotAlt}
                      width={band.shotW}
                      height={band.shotH}
                      sizes="280px"
                      className="rounded-[14px]"
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
