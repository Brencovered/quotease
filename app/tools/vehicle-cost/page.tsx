import type { Metadata } from "next";
import { ToolShell } from "@/components/marketing/tools/ToolShell";
import VehicleCostCalculator from "@/components/marketing/tools/VehicleCostCalculator";
import FaqSchema from "@/components/seo/FaqSchema";
import { VEHICLE_FAQS, getToolBySlug } from "@/lib/marketing/tools";

const tool = getToolBySlug("vehicle-cost")!;

export const metadata: Metadata = {
  title: `${tool.title} - Swiftscope`,
  description: tool.description,
  alternates: { canonical: "https://swiftscope.com.au/tools/vehicle-cost" },
  openGraph: { title: tool.title, description: tool.description },
};

export default function VehicleCostPage() {
  const faqs = VEHICLE_FAQS.map((f) => ({ question: f.q, answer: f.a }));
  return (
    <>
      <ToolShell tool={tool} seoFaqs={VEHICLE_FAQS}>
        <VehicleCostCalculator />
      </ToolShell>
      <FaqSchema faqs={faqs} />
    </>
  );
}
