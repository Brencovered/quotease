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
    question: "Is Swiftscope free for homeowners?",
    answer: "Yes. Posting a job and receiving quotes from local tradies is completely free for homeowners. You only contact the tradie you want to hire.",
  },
  {
    question: "How many quotes will I receive?",
    answer: "Up to 3 local tradies matched to your job will be able to respond with a quote. You compare them and choose who to hire.",
  },
  {
    question: "How are tradies selected?",
    answer: "Every listing on Swiftscope is curated. We display real Google ratings and review counts so you can compare businesses before making contact.",
  },
  {
    question: "How quickly will I hear back?",
    answer: "Most homeowners receive their first quote within a few hours. Response times depend on the trade and your suburb.",
  },
  {
    question: "What trades can I find on Swiftscope?",
    answer: "Electricians, plumbers, builders, roofers, painters, carpenters, tilers, landscapers, concreters, fencers, arborists, air conditioning installers, and surveyors.",
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
      answer: `Post your job on Swiftscope - it's free. Local ${suburb} ${tradePlural.toLowerCase()} will respond with quotes. You can compare Google ratings and reviews before choosing who to contact.`,
    },
    {
      question: `Do ${suburb} ${tradePlural.toLowerCase()} on Swiftscope have insurance?`,
      answer: `All tradies on Swiftscope are independent businesses responsible for their own licensing and insurance. We recommend confirming licence details with your chosen ${tradeSingular.toLowerCase()} directly before work begins.`,
    },
    {
      question: `Can I get same-day quotes from ${suburb} ${tradePlural.toLowerCase()}?`,
      answer: `Many ${suburb} ${tradePlural.toLowerCase()} on Swiftscope respond to job requests within a few hours. Post your job now and see who's available.`,
    },
  ];
}
