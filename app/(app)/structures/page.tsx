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

  const [{ data: rows, error }, { data: templateRows }, { data: clients }] = await Promise.all([
    supabase
      .from("structure_plans")
      .select("id, name, summary, materials_total, labour_hours, updated_at, quote_id, clients(name)")
      .eq("profile_id", businessId)
      .eq("is_template", false)
      .order("updated_at", { ascending: false })
      .range(0, 199),
    supabase
      .from("structure_plans")
      .select("id, name, summary")
      .eq("profile_id", businessId)
      .eq("is_template", true)
      .order("name")
      .range(0, 99),
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

  const templates = (templateRows ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    description: parseSummary(t.summary).description ?? null,
  }));

  return (
    <>
      <AppHeader />
      <div className="page-wrap">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-[26px] text-[var(--ink)]">Build planner</h1>
            <p className="text-[13.5px] text-[var(--ink-faint)] mt-0.5 max-w-[60ch]">
              Describe any framed build or start from one of your templates. Get the 3D model, framing, cut list, materials and labour, then turn it into a quote and hand the client real plans.
            </p>
          </div>
          <NewStructureButton clients={clients ?? []} templates={templates} />
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
              Type or say what you are building, like a 6 x 9 m workshop with a 3 m roller door. Change anything in 3D and the materials and labour update as you go.
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

        {templates.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-[19px] text-[var(--ink)] mb-1">Your templates</h2>
            <p className="text-[13px] text-[var(--ink-faint)] mb-3">
              Saved from the planner. Pick one when you start a new build, or open it here to change the template itself.
            </p>
            <ul className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/structures/${t.id}`}
                    className="inline-flex flex-col border border-[var(--line)] bg-[var(--surface)] rounded-xl px-3.5 py-2 hover:border-[var(--ink-faint)]"
                  >
                    <span className="text-[13.5px] font-bold text-[var(--ink)]">{t.name}</span>
                    {t.description && <span className="text-[11.5px] text-[var(--ink-faint)]">{t.description}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
