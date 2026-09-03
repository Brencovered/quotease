import { Quote } from "lucide-react";

export interface Testimonial {
  text: string;
  author: string | null;
}

/**
 * Testimonials scraped from a business's own website - a free,
 * billing-independent complement to Google reviews (which require
 * Places API billing, currently disabled on the Google Cloud project,
 * so ReviewsSection renders nothing for anyone until that's fixed).
 * These are real customer quotes the business chose to publish about
 * themselves, not independently verified the way a Google review is -
 * labelled as such rather than presented with the same weight as
 * ReviewsSection's "Reviews via Google" attribution.
 */
export default function TestimonialsSection({ testimonials }: { testimonials: Testimonial[] }) {
  if (testimonials.length === 0) return null;

  return (
    <div className="reveal">
      <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
        What clients say
      </p>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        {testimonials.slice(0, 5).map((t, i) => (
          <div key={i} className={i > 0 ? "pt-5 border-t border-gray-100" : ""}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full shrink-0 bg-gray-100 flex items-center justify-center">
                <Quote size={14} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] text-gray-600 leading-relaxed">{t.text}</p>
                {t.author && (
                  <p className="font-bold text-[12.5px] text-gray-700 mt-2">{t.author}</p>
                )}
              </div>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-gray-400 pt-2">From the business&apos;s own website</p>
      </div>
    </div>
  );
}
