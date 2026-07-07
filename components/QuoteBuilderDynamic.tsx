"use client";

import dynamic from "next/dynamic";

/**
 * QuoteBuilder wrapper — lazy-loads the heavy quote builder
 * so the initial page shell renders instantly while the
 * builder chunks download in the background.
 */

const QuoteBuilder = dynamic(() => import("./QuoteBuilder"), {
  loading: () => (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--line)] border-t-[var(--navy)]" />
      <p className="text-[13px] font-semibold text-[var(--ink-faint)]">Loading quote builder...</p>
    </div>
  ),
  ssr: false, // Builder uses browser APIs (canvas, mic, etc)
});

export default function QuoteBuilderDynamic(props: React.ComponentProps<typeof QuoteBuilder>) {
  return <QuoteBuilder {...props} />;
}

// Re-export the other builders as lazy-loaded variants
export const PlumberQuoteBuilderDynamic = dynamic(
  () => import("./PlumberQuoteBuilder"),
  { ssr: false }
);

export const CarpenterQuoteBuilderDynamic = dynamic(
  () => import("./CarpenterQuoteBuilder"),
  { ssr: false }
);

export const RooferQuoteBuilderDynamic = dynamic(
  () => import("./RooferQuoteBuilder"),
  { ssr: false }
);

export const GenericQuoteBuilderDynamic = dynamic(
  () => import("./GenericQuoteBuilder"),
  { ssr: false }
);
