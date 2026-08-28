import { AdminDirectoryPageScraper } from "@/components/AdminDirectoryPageScraper";

export const dynamic = "force-dynamic";

export default function AdminPageScraperPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-[var(--ink)]">Directory page scraper</h1>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Paste a Google or Yellow Pages results URL. Google pages are looked up on
          Yellow Pages when Places billing is off.
        </p>
      </div>
      <AdminDirectoryPageScraper />
    </div>
  );
}
