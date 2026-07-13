"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function PhotoGallery({
  photos,
  name,
}: {
  photos: string[];
  name: string;
}) {
  const [idx, setIdx] = useState(0);
  const visible = photos.slice(0, 6);

  return (
    <div className="reveal">
      <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Photos
      </p>

      {/* Main photo */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 mb-2">
        <Image
          src={`/api/places/photo?ref=${visible[idx]}&maxw=800`}
          alt={`${name} - photo ${idx + 1}`}
          fill
          sizes="(max-width: 640px) 100vw, 600px"
          className="object-cover"
        />
        {visible.length > 1 && (
          <>
            <button
              onClick={() =>
                setIdx((i) => (i - 1 + visible.length) % visible.length)
              }
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
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === idx ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {visible.length > 1 && (
        <div className="flex gap-2">
          {visible.map((ref, i) => (
            <button
              key={ref}
              onClick={() => setIdx(i)}
              className={`relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${
                i === idx ? "border-[#ffb400]" : "border-transparent"
              }`}
            >
              <Image
                src={`/api/places/photo?ref=${ref}&maxw=150`}
                alt={`${name} thumbnail ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
