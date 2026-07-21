"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Only renders photos that are already cached as real URLs (Supabase Storage
 * or tradie-uploaded). Never calls /api/places/photo -- that hits Google
 * API on every view and runs up costs. Uncached Google photo_reference tokens
 * are silently filtered out.
 */
export default function PhotoGallery({
  photos,
  name,
}: {
  photos: string[];
  name: string;
}) {
  // Only show photos that are real cached URLs, not Google opaque tokens
  const cached = photos.filter(p => p.startsWith("http"));
  const [idx, setIdx] = useState(0);

  if (cached.length === 0) return null;

  const visible = cached.slice(0, 6);

  return (
    <div className="reveal">
      <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Photos
      </p>

      {/* Main photo */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 mb-2">
        <Image
          src={visible[idx]}
          alt={`${name} - photo ${idx + 1}`}
          fill
          sizes="(max-width: 640px) 100vw, 600px"
          className="object-cover"
        />
        {visible.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + visible.length) % visible.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % visible.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {visible.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/40"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {visible.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {visible.map((src, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`relative flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${i === idx ? "border-[#ffb400]" : "border-transparent"}`}
            >
              <Image src={src} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
