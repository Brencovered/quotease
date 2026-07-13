import { Star, Quote } from "lucide-react";
import type { GoogleReview } from "@/lib/googleReviews";

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          className={i <= Math.round(rating) ? "fill-[#ffb400] text-[#ffb400]" : "text-gray-200 fill-gray-200"}
        />
      ))}
    </span>
  );
}

export default function ReviewsSection({ reviews }: { reviews: GoogleReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <div className="reveal">
      <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
        What customers say
      </p>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        {reviews.slice(0, 5).map((review, i) => (
          <div key={`${review.authorName}-${review.time}-${i}`} className={i > 0 ? "pt-5 border-t border-gray-100" : ""}>
            <div className="flex items-start gap-3">
              {review.authorPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={review.authorPhotoUrl}
                  alt=""
                  className="w-9 h-9 rounded-full shrink-0 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full shrink-0 bg-gray-100 flex items-center justify-center">
                  <Quote size={14} className="text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-[13.5px] text-gray-900">{review.authorName}</p>
                  {review.relativeTime && (
                    <span className="text-[12px] text-gray-400">{review.relativeTime}</span>
                  )}
                </div>
                <ReviewStars rating={review.rating} />
                <p className="text-[13.5px] text-gray-600 leading-relaxed mt-2">{review.text}</p>
              </div>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-gray-400 pt-2">Reviews via Google</p>
      </div>
    </div>
  );
}
