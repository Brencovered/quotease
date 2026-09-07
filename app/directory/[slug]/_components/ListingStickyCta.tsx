"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Phone } from "lucide-react";

/**
 * Mobile-only bottom bar. Directory listing pages used to leave Call and
 * Get a quote below the fold after photos and reviews. This keeps the
 * next step on screen until the visitor can see the form itself.
 */
export default function ListingStickyCta({
  phone,
  businessName,
}: {
  phone: string | null;
  businessName: string;
}) {
  const [formInView, setFormInView] = useState(false);

  useEffect(() => {
    const el = document.getElementById("quote-form");
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFormInView(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (formInView) return null;

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur-md">
      <div
        className="max-w-6xl mx-auto px-4 pt-2.5 flex gap-2"
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        <a
          href="#quote-form"
          className="flex-1 bg-[#ffb400] text-[#0a1722] font-extrabold text-[13.5px] py-3 rounded-xl flex items-center justify-center gap-2"
        >
          <MessageSquare size={14} /> Get a quote
        </a>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex-1 bg-[#0a1722] text-white font-bold text-[13.5px] py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <Phone size={14} /> Call
          </a>
        )}
      </div>
      <p className="sr-only">Get a quote from {businessName}</p>
    </div>
  );
}
