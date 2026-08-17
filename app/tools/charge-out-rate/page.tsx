import type { Metadata } from "next";
import { ToolShell } from "@/components/marketing/tools/ToolShell";
import ChargeOutCalculator from "@/components/marketing/tools/ChargeOutCalculator";
import FaqSchema from "@/components/seo/FaqSchema";
import { CHARGE_OUT_FAQS, getToolBySlug } from "@/lib/marketing/tools";

const tool = getToolBySlug("charge-out-rate")!;

export const metadata: Metadata = {
  title: `${tool.title} - Swiftscope`,
  description: tool.description,
  alternates: { canonical: "https://swiftscope.com.au/tools/charge-out-rate" },
  openGraph: { title: tool.title, description: tool.description },
};

export default function ChargeOutRatePage() {
  const faqs = CHARGE_OUT_FAQS.map((f) => ({ question: f.q, answer: f.a }));
  return (
    <>
      <ToolShell tool={tool} seoFaqs={CHARGE_OUT_FAQS}>
        <ChargeOutCalculator />
      </ToolShell>
      <FaqSchema faqs={faqs} />
    </>
  );
}
