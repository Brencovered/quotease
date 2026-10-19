import Link from "next/link";
import { redirect } from "next/navigation";
import { Warehouse } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import NewStructureButton from "@/components/structures/NewStructureButton";
import { parseSummary } from "@/lib/structurePlans";

export const dynamic = "force-dynamic";

const money = (v: number) =>
  "$" + Math.round(v).toLocaleString("en-AU");

export default async function StructuresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const businessId = await getActiveBusinessId(supabase, user.id);

  const [{ data: rows, error }, { data: clients }] = await Promise.all([
    supabase
      .from("structure_plans")
      .select("id, name, summary, materials_total, labour_hours, updated_at, quote_id, clients(name)")
      .eq("profile_id", businessId)
      .order("updated_at", { ascending: false })
      .range(0, 199),
    supabase.from("clients").select("id, name, billing_address").eq("profile_id", businessId).order("name").range(0, 999),
  ]);

  const plans = (rows ?? []).map((r) => {
    const summary = parseSummary(r.summary);
    const client = r.clients as unknown as { name: string | null } | null;
    return {
      id: r.id as string,
      name: r.name as string,
      clientName: client?.name ?? null,
      description: summary.description ?? null,
      materials: Number(r.materials_total) || 0,
      hours: Number(r.labour_hours) || 0,
      updatedAt: r.updated_at as string,
      quoted: Boolean(r.quote_id),
    };
  });

  return (
    <>
      <AppHeader />
      <div className="page-wrap">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-[26px] text-[var(--ink)]">Build planner</h1>
            <p className="text-[13.5px] text-[var(--ink-faint)] mt-0.5 max-w-[60ch]">
              Design a shed, garage, workshop or studio in 3D. Get the framing, cut list, materials and labour, then turn it into a quote and hand the client real plans.
            </p>
          </div>
          <NewStructureButton clients={clients ?? []} />
        </div>

        {error && (
          <div className="card mb-4 text-[13.5px] text-[var(--ink-soft)]">
            The build planner is not set up on this account yet. Try again shortly.
          </div>
        )}

        {plans.length === 0 && !error ? (
          <div className="card flex flex-col items-center text-center py-12">
            <Warehouse size={36} className="text-[var(--amber-deep)] mb-3" />
            <p className="font-bold text-[16px] text-[var(--ink)]">No builds yet</p>
            <p className="text-[13.5px] text-[var(--ink-faint)] mt-1 max-w-[44ch]">
              Start from a template like a single garage or backyard studio, change it to suit the site, and the materials list and labour update as you go.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/structures/${p.id}`}
                  className="card block h-full hover:border-[var(--ink-faint)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-[15px] text-[var(--ink)] leading-tight">{p.name}</p>
                    {p.quoted && <span className="pill bg-[var(--amber-light)] text-[var(--amber-deep)]">Quoted</span>}
                  </div>
                  <p className="text-[12.5px] text-[var(--ink-faint)] mt-1">
                    {p.clientName ?? "No client"} · updated {new Date(p.updatedAt).toLocaleDateString("en-AU")}
                  </p>
                  {p.description && <p className="text-[13px] text-[var(--ink-soft)] mt-2">{p.description}</p>}
                  <div className="flex gap-4 mt-3 text-[13px]">
                    <span><b className="text-[var(--ink)]">{money(p.materials)}</b> <span className="text-[var(--ink-faint)]">materials</span></span>
                    <span><b className="text-[var(--ink)]">{Math.round(p.hours * 10) / 10} h</b> <span className="text-[var(--ink-faint)]">labour</span></span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
