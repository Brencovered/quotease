import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login?next=/admin");

  if (!isAdminEmail(userData.user.email)) {
    return (
      <main className="min-h-screen bg-[var(--app-bg)] flex items-center justify-center px-4">
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 max-w-sm text-center">
          <p className="font-display text-lg text-[var(--ink)] mb-2">Not authorised</p>
          <p className="text-[13.5px] text-[var(--ink-soft)]">
            This account doesn&apos;t have access to the admin dashboard.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <header className="bg-[var(--navy)] px-5 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/admin/tradies" className="font-display text-lg text-white">
            Swiftscope <span className="text-[var(--amber)]">Admin</span>
          </Link>
          <nav className="flex items-center gap-5 text-[13px] font-semibold">
            <Link href="/admin/tradies" className="text-[var(--steel-1)] hover:text-white">Tradie accounts</Link>
            <Link href="/admin/directory" className="text-[var(--steel-1)] hover:text-white">Directory</Link>
            <Link href="/admin/directory/coverage" className="text-[var(--steel-1)] hover:text-white">Coverage</Link>
            <Link href="/admin/outreach" className="text-[var(--steel-1)] hover:text-white">Outreach</Link>
            <Link href="/admin/quote-requests" className="text-[var(--steel-1)] hover:text-white">Quote requests</Link>
            <Link href="/admin/roadmap" className="text-[var(--steel-1)] hover:text-white">Roadmap</Link>
            <Link href="/admin/blog" className="text-[var(--steel-1)] hover:text-white">Blog</Link>
            <Link href="/admin/seo" className="text-[var(--steel-1)] hover:text-white">SEO</Link>
            <Link href="/admin/integrations" className="text-[var(--amber)] hover:text-white">Integrations</Link>
            <Link href="/admin/scraper" className="text-[var(--amber)] hover:text-white">Scraper</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-5 py-6">{children}</main>
    </div>
  );
}
