import type { Metadata } from "next";
import { ToolShell } from "@/components/marketing/tools/ToolShell";
import HireChecklist from "@/components/marketing/tools/HireChecklist";
import { getToolBySlug } from "@/lib/marketing/tools";

const tool = getToolBySlug("hire-checklist")!;

export const metadata: Metadata = {
  title: `${tool.title} - Swiftscope`,
  description: tool.description,
  alternates: { canonical: "https://swiftscope.com.au/tools/hire-checklist" },
};

export default function HireChecklistPage() {
  return (
    <ToolShell tool={tool}>
      <HireChecklist />
    </ToolShell>
  );
}
