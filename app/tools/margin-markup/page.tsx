import type { Metadata } from "next";
import { ToolShell } from "@/components/marketing/tools/ToolShell";
import MarginMarkupCalculator from "@/components/marketing/tools/MarginMarkupCalculator";
import FaqSchema from "@/components/seo/FaqSchema";
import { MARGIN_FAQS, getToolBySlug } from "@/lib/marketing/tools";

const tool = getToolBySlug("margin-markup")!;

export const metadata: Metadata = {
  title: `${tool.title} - Swiftscope`,
  description: tool.description,
  alternates: { canonical: "https://swiftscope.com.au/tools/margin-markup" },
  openGraph: { title: tool.title, description: tool.description },
};

export default function MarginMarkupPage() {
  const faqs = MARGIN_FAQS.map((f) => ({ question: f.q, answer: f.a }));
  return (
    <>
      <ToolShell tool={tool} seoFaqs={MARGIN_FAQS}>
        <MarginMarkupCalculator />
      </ToolShell>
      <FaqSchema faqs={faqs} />
    </>
  );
}
