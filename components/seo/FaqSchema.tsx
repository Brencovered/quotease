/**
 * components/seo/FaqSchema.tsx
 * -----------------------------
 * FAQPage JSON-LD schema.
 * Drop anywhere a page has a visible Q&A section.
 * Google will show FAQs as rich results (expandable in SERPs) when:
 * - The Q&A content is actually visible on the page (not just in JSON-LD)
 * - There are ≤ 10 questions (Google truncates above this)
 * - Answers are ≤ 300 characters for best display
 */

export interface FaqItem {
  question: string;
  answer: string;
}

export default function FaqSchema({ faqs }: { faqs: FaqItem[] }) {
  if (!faqs.length) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// -- Reusable FAQ sets ------------------------------------------------------------

/**
 * Generic FAQs about Swiftscope itself -- used on the homepage.
 */
export const SWIFTSCOPE_FAQS: FaqItem[] = [
  {
    question: "Who is Swiftscope for?",
    answer:
      "Solo tradies and small crews up to about 15. Residential and small commercial work. Not a site office system for 200.",
  },
  {
    question: "Can I quote on site from my phone?",
    answer:
      "Yes. Mark up a plan or photo, load materials and labour from your price book, and send a priced quote before you leave the driveway.",
  },
  {
    question: "How does the client accept a quote?",
    answer:
      "They open a clean portal on their phone and tap accept. The job lands on your board. No PDF chase, no did you get my email.",
  },
  {
    question: "What does it cost?",
    answer:
      "Flat $45 a month after a 7-day free trial. Unlimited quotes, jobs, and seats. No per-lead fees. Directory listing included.",
  },
  {
    question: "Can homeowners browse tradies for free?",
    answer:
      "Yes. The directory is free to browse by trade and suburb, with real Google ratings on listings. No signup required to look.",
  },
];

/**
 * Trade×suburb FAQs. Answers are generated from live data where possible.
 * The trade/suburb/state strings passed here should already be human-readable
 * (e.g. "Electrician", "Seaford", "VIC") not slugified.
 */
export function generateTradeSuburbFaqs(
  tradeSingular: string,
  tradePlural: string,
  suburb: string,
  state: string,
  listingCount: number,
  avgRating?: number
): FaqItem[] {
  const ratingLine = avgRating
    ? ` They have an average Google rating of ${avgRating.toFixed(1)} stars.`
    : "";

  return [
    {
      question: `How much does a ${tradeSingular.toLowerCase()} cost in ${suburb}?`,
      answer: `${tradeSingular} costs in ${suburb} vary by job complexity. Most ${suburb} residents use Swiftscope to get up to 3 free quotes and compare pricing before deciding.`,
    },
    {
      question: `How many ${tradePlural.toLowerCase()} are available in ${suburb}?`,
      answer: `There are ${listingCount} curated ${tradePlural.toLowerCase()} listings in ${suburb} on Swiftscope.${ratingLine}`,
    },
    {
      question: `How do I find a reliable ${tradeSingular.toLowerCase()} in ${suburb}, ${state}?`,
      answer: `Browse the ${suburb} ${tradePlural.toLowerCase()} listed on Swiftscope, it's free. Compare Google ratings, reviews, licences and photos, then contact your chosen ${tradeSingular.toLowerCase()} directly by phone, website, or quote request.`,
    },
    {
      question: `Do ${suburb} ${tradePlural.toLowerCase()} on Swiftscope have insurance?`,
      answer: `All tradies on Swiftscope are independent businesses responsible for their own licensing and insurance. We recommend confirming licence details with your chosen ${tradeSingular.toLowerCase()} directly before work begins.`,
    },
    {
      question: `Can I get same-day quotes from ${suburb} ${tradePlural.toLowerCase()}?`,
      answer: `Many ${suburb} ${tradePlural.toLowerCase()} on Swiftscope respond quickly to direct enquiries. Contact a few directly by phone or quote request to compare availability.`,
    },
  ];
}
