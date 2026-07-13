"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Errors caught here already reach Vercel's runtime error log via the
    // server-side throw, but logging client-side too catches anything
    // that only surfaces after hydration.
    console.error("Unhandled page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--navy)] flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={24} className="text-[var(--amber)]" />
        </div>
        <h1 className="font-display text-[1.6rem] text-[var(--ink)] mb-2 uppercase">
          Something went wrong
        </h1>
        <p className="text-[14px] text-[var(--ink-faint)] mb-8 leading-relaxed">
          That&apos;s on us, not you. The page hit an unexpected error - try again,
          or head back to the homepage. If it keeps happening, let us know.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => reset()} className="btn-primary justify-center">
            <RotateCcw size={15} /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 text-[14px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-xl px-4 py-2.5 hover:border-[var(--navy)] transition-colors"
          >
            Back to homepage
          </Link>
        </div>
        {error.digest && (
          <p className="text-[11px] text-[var(--ink-faint)] mt-6">Error reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
