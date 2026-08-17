import type { Metadata } from "next";
import { ToolShell } from "@/components/marketing/tools/ToolShell";
import DiyCalculators from "@/components/marketing/tools/DiyCalculators";
import { getToolBySlug } from "@/lib/marketing/tools";

const tool = getToolBySlug("diy-materials")!;

export const metadata: Metadata = {
  title: `${tool.title} - Swiftscope`,
  description: tool.description,
  alternates: { canonical: "https://swiftscope.com.au/tools/diy-materials" },
};

export default function DiyMaterialsPage() {
  return (
    <ToolShell tool={tool}>
      <DiyCalculators />
    </ToolShell>
  );
}
