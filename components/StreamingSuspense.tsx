"use client";

import { Suspense } from "react";

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-[var(--line-subtle)] rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
      ))}
    </div>
  );
}

export default function StreamingSuspense({
  children,
  lines,
}: {
  children: React.ReactNode;
  lines?: number;
}) {
  return <Suspense fallback={<Skeleton lines={lines} />}>{children}</Suspense>;
}
