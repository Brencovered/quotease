import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import SuppliersPanel from "@/components/SuppliersPanel";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const businessId = await getActiveBusinessId(supabase, user.id);

  const [{ data: profile }, { data: suppliers }, { data: catalog }] = await Promise.all([
    supabase.from("profiles").select("trades").eq("id", businessId).single(),
    supabase.from("business_suppliers").select("*").eq("profile_id", businessId).order("created_at", { ascending: false }),
    supabase.from("supplier_catalog").select("*").order("sort_order"),
  ]);

  return (
    <>
      <AppHeader />
      <div className="page-wrap-narrow">
        <div className="mb-6">
          <h1 className="font-display text-[26px] text-[var(--ink)]">Suppliers</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
            Add your suppliers and we&apos;ll give you a unique email address for each. Once they send invoices or
            price lists there, your price book updates itself automatically.
          </p>
        </div>
        <SuppliersPanel
          suppliers={suppliers ?? []}
          catalog={catalog ?? []}
          myTrades={profile?.trades ?? []}
        />
      </div>
    </>
  );
}
