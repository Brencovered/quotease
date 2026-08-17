import type { Metadata } from "next";
import { ToolShell } from "@/components/marketing/tools/ToolShell";
import MarginMarkupCalculator from "@/components/marketing/tools/MarginMarkupCalculator";
import { getToolBySlug } from "@/lib/marketing/tools";

const tool = getToolBySlug("margin-markup")!;

export const metadata: Metadata = {
  title: `${tool.title} - Swiftscope`,
  description: tool.description,
  alternates: { canonical: "https://swiftscope.com.au/tools/margin-markup" },
};

export default function MarginMarkupPage() {
  return (
    <ToolShell tool={tool}>
      <MarginMarkupCalculator />
    </ToolShell>
  );
}
