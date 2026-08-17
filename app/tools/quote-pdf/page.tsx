import type { Metadata } from "next";
import { ToolShell } from "@/components/marketing/tools/ToolShell";
import QuotePdfGenerator from "@/components/marketing/tools/QuotePdfGenerator";
import { getToolBySlug } from "@/lib/marketing/tools";

const tool = getToolBySlug("quote-pdf")!;

export const metadata: Metadata = {
  title: `${tool.title} - Swiftscope`,
  description: tool.description,
  alternates: { canonical: "https://swiftscope.com.au/tools/quote-pdf" },
};

export default function QuotePdfPage() {
  return (
    <ToolShell tool={tool}>
      <QuotePdfGenerator />
    </ToolShell>
  );
}
