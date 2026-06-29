import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GetQuotesForm from "@/components/GetQuotesForm";
import Link from "next/link";

export default async function GetQuotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check if homeowner profile exists
  let homeowner = null;
  if (user) {
    const { data } = await supabase
      .from("homeowner_profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    homeowner = data;
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--app-bg)" }}>
      <div style={{ background: "var(--navy)" }} className="text-white">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="font-display text-[20px] text-[var(--amber)]">Swiftscope</Link>
            {!user && (
              <Link href="/login" className="text-white/70 hover:text-white text-[13px] font-semibold">Log in</Link>
            )}
          </div>
          <p className="text-[11px] font-bold tracking-[.2em] uppercase text-[var(--amber)] mb-2">Get quotes</p>
          <h1 className="font-display text-[2.2rem] leading-tight mb-2">Tell us what you need done</h1>
          <p className="text-[var(--steel-2)] text-[14px]">
            Up to 3 local tradies will contact you directly. No spam, no auction -- just qualified local businesses.
          </p>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <GetQuotesForm user={user} homeowner={homeowner} />
      </div>
    </main>
  );
}
