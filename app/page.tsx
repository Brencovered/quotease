import Link from "next/link";

const TRADES = [
  { slug: "electrician", label: "Electrician", ready: true },
  { slug: "plumber", label: "Plumber", ready: false },
  { slug: "carpenter", label: "Carpenter", ready: false },
  { slug: "tiler", label: "Tiler", ready: false },
];

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-medium mb-2">Quote faster, on site</h1>
      <p className="text-neutral-500 mb-10">
        Pick your trade. Every job after that uses fields built for how you actually work.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TRADES.map((t) =>
          t.ready ? (
            <Link
              key={t.slug}
              href="/login"
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-blue-500 bg-blue-50 p-5 hover:bg-blue-100 transition"
            >
              <span className="font-medium text-blue-900">{t.label}</span>
              <span className="text-xs text-blue-700">Ready now</span>
            </Link>
          ) : (
            <div
              key={t.slug}
              className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 p-5 opacity-40"
            >
              <span className="font-medium">{t.label}</span>
              <span className="text-xs text-neutral-500">Coming soon</span>
            </div>
          )
        )}
      </div>
    </main>
  );
}
