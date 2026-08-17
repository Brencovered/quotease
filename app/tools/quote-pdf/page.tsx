import type { Metadata } from "next";
import { ToolShell } from "@/components/marketing/tools/ToolShell";
import QuotePdfGenerator from "@/components/marketing/tools/QuotePdfGenerator";
import FaqSchema from "@/components/seo/FaqSchema";
import { QUOTE_PDF_FAQS, getToolBySlug } from "@/lib/marketing/tools";

const tool = getToolBySlug("quote-pdf")!;

export const metadata: Metadata = {
  title: `${tool.title} - Swiftscope`,
  description: tool.description,
  alternates: { canonical: "https://swiftscope.com.au/tools/quote-pdf" },
  openGraph: { title: tool.title, description: tool.description },
};

export default function QuotePdfPage() {
  const faqs = QUOTE_PDF_FAQS.map((f) => ({ question: f.q, answer: f.a }));
  return (
    <>
      <ToolShell tool={tool} seoFaqs={QUOTE_PDF_FAQS}>
        <QuotePdfGenerator />
      </ToolShell>
      <FaqSchema faqs={faqs} />
    </>
  );
}
