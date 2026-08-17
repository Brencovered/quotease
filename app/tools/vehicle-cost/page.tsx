import type { Metadata } from "next";
import { ToolShell } from "@/components/marketing/tools/ToolShell";
import VehicleCostCalculator from "@/components/marketing/tools/VehicleCostCalculator";
import { getToolBySlug } from "@/lib/marketing/tools";

const tool = getToolBySlug("vehicle-cost")!;

export const metadata: Metadata = {
  title: `${tool.title} - Swiftscope`,
  description: tool.description,
  alternates: { canonical: "https://swiftscope.com.au/tools/vehicle-cost" },
};

export default function VehicleCostPage() {
  return (
    <ToolShell tool={tool}>
      <VehicleCostCalculator />
    </ToolShell>
  );
}
