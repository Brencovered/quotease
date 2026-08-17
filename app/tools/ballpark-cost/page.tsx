import type { Metadata } from "next";
import { ToolShell } from "@/components/marketing/tools/ToolShell";
import BallparkEstimator from "@/components/marketing/tools/BallparkEstimator";
import { getToolBySlug } from "@/lib/marketing/tools";

const tool = getToolBySlug("ballpark-cost")!;

export const metadata: Metadata = {
  title: `${tool.title} - Swiftscope`,
  description: tool.description,
  alternates: { canonical: "https://swiftscope.com.au/tools/ballpark-cost" },
};

export default function BallparkCostPage() {
  return (
    <ToolShell tool={tool}>
      <BallparkEstimator />
    </ToolShell>
  );
}
