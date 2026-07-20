import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import { FEATURES_GRID, getFeatureBySlug } from "@/lib/marketing/features-grid-data";

export function generateStaticParams() {
  return FEATURES_GRID.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
  if (!feature) return { title: "Features - Swiftscope" };
  return {
    title: `${feature.label} - Swiftscope`,
    description: feature.note,
  };
}

export default async function FeatureDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
  if (!feature) notFound();

  const Icon = feature.icon;
  const otherFeatures = FEATURES_GRID.filter((f) => f.slug !== feature.slug);

  return (
    <main className="bg-white text-[#0a1722]">
      <MarketingNav />

      {/* HERO */}
      <div className="bg-[#0a1722] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-14">
          <Link href="/features" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#8aa4b4] hover:text-white transition-colors mb-6">
            <ArrowLeft size={14} /> All features
          </Link>
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${feature.type === "integrate" ? "bg-blue-500/20" : "bg-white/10"}`}>
                  <Icon size={20} className={feature.type === "integrate" ? "text-blue-300" : "text-[#ffb400]"} />
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                  feature.type === "integrate"
                    ? "bg-blue-500/10 text-blue-300 border-blue-400/30"
                    : "bg-red-500/10 text-red-300 border-red-400/30"
                }`}>
                  {feature.type === "integrate" ? `Integrates with ${feature.replaces}` : `Replaces ${feature.replaces}`}
                </span>
              </div>
              <h1 className="font-display uppercase text-[2.4rem] sm:text-[3rem] leading-[0.95] text-white mb-4">
                {feature.heroTitle}
              </h1>
              <p className="text-[16px] text-[#8aa4b4] max-w-lg">{feature.heroSubtitle}</p>
            </div>
            <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden bg-white/5">
              <Image
                src={feature.heroImage || feature.image}
                alt={feature.heroImageAlt || feature.imageAlt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className={`object-cover ${(feature.heroImage || feature.image).startsWith("/marketing/") ? "object-top" : "object-center"}`}
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="bg-white border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="md:col-span-2 space-y-5">
              {feature.intro.map((p, i) => (
                <p key={i} className="text-[16px] text-[#3a4a58] leading-relaxed">{p}</p>
              ))}
              {feature.costLabel && (
                <div className="bg-[#f8f9fa] border border-[#e8ecef] rounded-xl px-5 py-4 mt-2">
                  <p className="text-[13px] text-[#5a6a78]">
                    <span className="font-bold text-[#0a1722]">For comparison: </span>
                    {feature.costLabel}, versus $45/month flat for the whole Swiftscope platform.
                  </p>
                </div>
              )}
              <div className="pt-6">
                <Link href="/signup" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-7 py-3.5 rounded-xl hover:opacity-90">
                  Start free trial <ArrowRight size={15} />
                </Link>
              </div>
            </div>
            <div>
              <div className="bg-[#f8f9fa] border border-[#e8ecef] rounded-2xl p-6">
                <p className="text-[11px] font-bold tracking-[.15em] uppercase text-[#ffb400] mb-4">What it does</p>
                <ul className="space-y-3">
                  {feature.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check size={16} className="text-[#e89e00] shrink-0 mt-0.5" />
                      <span className="text-[13.5px] text-[#3a4a58] leading-snug">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OTHER FEATURES */}
      <div className="bg-[#f8f9fa] border-b border-[#e8ecef]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400] mb-3">Keep exploring</p>
          <h2 className="font-display uppercase text-[1.8rem] sm:text-[2.2rem] leading-[0.95] text-[#0a1722] mb-8">
            The rest of the platform
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherFeatures.map((r) => {
              const OtherIcon = r.icon;
              return (
                <Link
                  key={r.slug}
                  href={`/features/${r.slug}`}
                  className="group block rounded-2xl border bg-white border-[#e8ecef] overflow-hidden transition-shadow hover:shadow-lg"
                >
                  <div className="relative h-52 w-full overflow-hidden bg-[#0a1722]">
                    <Image
                      src={r.image}
                      alt={r.imageAlt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className={`object-cover transition-transform duration-300 group-hover:scale-105 ${r.image.startsWith("/marketing/") ? "object-top" : "object-center"}`}
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.type === "integrate" ? "bg-blue-100" : "bg-[#0a1722]"}`}>
                        <OtherIcon size={14} className={r.type === "integrate" ? "text-blue-600" : "text-[#ffb400]"} />
                      </div>
                      <p className="font-bold text-[14px] text-[#0a1722] group-hover:underline">{r.label}</p>
                    </div>
                    <p className="text-[12.5px] text-[#5a6a78] leading-relaxed">{r.note}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div className="bg-[#0a1722]">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <h3 className="font-display text-[1.8rem] sm:text-[2.2rem] text-white mb-3">Ready to see it on your own jobs?</h3>
          <Link href="/signup" className="inline-flex items-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] px-8 py-4 rounded-xl hover:opacity-90">
            Start free trial <ArrowRight size={15} />
          </Link>
        </div>
        <div className="border-t border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-lg text-white">SWIFTSCOPE</span>
            <div className="flex gap-6 text-[12.5px] font-semibold text-white/40">
              <Link href="/features" className="hover:text-white transition-colors">Features</Link>
              <Link href="/how-it-works" className="hover:text-white transition-colors">How it works</Link>
              <Link href="/directory" className="hover:text-white transition-colors">Directory</Link>
              <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
