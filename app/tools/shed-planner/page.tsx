import type { Metadata } from "next";
import Link from "next/link";
import { ToolShell } from "@/components/marketing/tools/ToolShell";
import FaqSchema from "@/components/seo/FaqSchema";
import { SHED_PLANNER_FAQS, getToolBySlug } from "@/lib/marketing/tools";

const tool = getToolBySlug("shed-planner")!;

export const metadata: Metadata = {
  title: `${tool.title} - Swiftscope`,
  description: tool.description,
  alternates: { canonical: "https://swiftscope.com.au/tools/shed-planner" },
  openGraph: { title: tool.title, description: tool.description },
};

export default function ShedPlannerPage() {
  const faqs = SHED_PLANNER_FAQS.map((f) => ({ question: f.q, answer: f.a }));
  return (
    <>
      <ToolShell tool={tool} seoFaqs={SHED_PLANNER_FAQS}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="font-sans text-[14.5px] leading-[1.6] text-[#3d4a55] max-w-[62ch]">
            Pick a template on the Build tab, then tap any part of the model to change it. Your design saves in this browser.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center font-sans text-[13.5px] font-bold text-[#071018] bg-[#ffb400] px-4 py-2.5"
          >
            Save builds and quote them
          </Link>
        </div>
        <div className="bg-white border border-[#e4e8ec] h-[85vh] min-h-[560px] lg:h-[820px]">
          <iframe
            src="/planner/build-planner.html"
            title="3D shed and garage planner"
            className="w-full h-full border-0 block"
            loading="lazy"
          />
        </div>
      </ToolShell>
      <FaqSchema faqs={faqs} />
    </>
  );
}
