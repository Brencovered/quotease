import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import DocketSignForm from "@/components/DocketSignForm";
import type { DocketItem } from "@/lib/dockets";

function summaryTable(title: string, items: DocketItem[], columns: { key: string; label: string }[]) {
  if (items.length === 0) return null;
  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold tracking-wide uppercase text-[#8a9ba8] mb-2">{title}</p>
      <div className="border border-[#e8ecef] rounded-lg overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-[#f8f9fa] text-left text-[#5a6a78]">
              {columns.map((c) => <th key={c.key} className="px-3 py-2 font-semibold">{c.label}</th>)}
              <th className="px-3 py-2 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-[#e8ecef]">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-[#3a4a58]">
                    {c.key === "name" ? (it.person_name || it.label) : c.key === "role" ? it.label : c.key === "hours" ? `${it.quantity}h` : c.key === "qty" ? it.quantity : c.key === "rate" ? `$${it.rate}` : ""}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold text-[#0a1722]">${it.line_total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function PublicDocketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: docket } = await supabase
    .from("dockets")
    .select(
      "id, work_date, description, weather, client_name, total_cost, status, signed_by_name, signed_at, docket_items(*), jobs(job_number, title, client_name, site_address, profiles!jobs_profile_id_fkey(business_name, logo_url, contact_phone, business_address))"
    )
    .eq("public_token", token)
    .single();

  if (!docket) notFound();

  const job = docket.jobs as unknown as {
    job_number: number;
    title: string | null;
    client_name: string | null;
    site_address: string | null;
    profiles: { business_name?: string; logo_url?: string | null; contact_phone?: string | null; business_address?: string | null };
  };
  const profile = job?.profiles;
  const items = (docket.docket_items ?? []) as DocketItem[];
  const labourItems = items.filter((i) => i.category === "labour");
  const plantItems = items.filter((i) => i.category === "plant");
  const materialItems = items.filter((i) => i.category === "material");
  const customItems = items.filter((i) => i.category === "custom");

  const alreadySigned = docket.status === "signed" || docket.status === "invoiced";
  const workDate = new Date(docket.work_date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="min-h-screen bg-[#f4f6f7] py-10 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-[#0a1722] px-6 py-5">
          <p className="text-[12px] font-semibold text-[#8aa4b4] uppercase tracking-wide">Dayworks docket</p>
          <p className="text-white font-bold text-[20px] mt-0.5">{profile?.business_name || "Job"} - Job #{job?.job_number}{job?.title ? ` - ${job.title}` : ""}</p>
        </div>

        <div className="px-6 py-6">
          <div className="mb-5 space-y-1">
            {profile?.business_name && <p className="text-[13px] text-[#5a6a78]"><span className="font-semibold text-[#0a1722]">Company:</span> {profile.business_name}</p>}
            {profile?.business_address && <p className="text-[13px] text-[#5a6a78]"><span className="font-semibold text-[#0a1722]">Address:</span> {profile.business_address}</p>}
            {profile?.contact_phone && <p className="text-[13px] text-[#5a6a78]"><span className="font-semibold text-[#0a1722]">Phone:</span> {profile.contact_phone}</p>}
            <p className="text-[13px] text-[#5a6a78]"><span className="font-semibold text-[#0a1722]">Date of work:</span> {workDate}</p>
            {docket.weather && <p className="text-[13px] text-[#5a6a78]"><span className="font-semibold text-[#0a1722]">Weather:</span> {docket.weather}</p>}
            {(docket.client_name || job?.client_name) && <p className="text-[13px] text-[#5a6a78]"><span className="font-semibold text-[#0a1722]">Client:</span> {docket.client_name || job.client_name}</p>}
            {job?.site_address && <p className="text-[13px] text-[#5a6a78]"><span className="font-semibold text-[#0a1722]">Site:</span> {job.site_address}</p>}
          </div>

          {docket.description && (
            <div className="bg-[#f8f9fa] rounded-xl px-4 py-3 mb-5">
              <p className="text-[11px] font-bold tracking-wide uppercase text-[#8a9ba8] mb-1">Description of work completed</p>
              <p className="text-[14px] text-[#3a4a58] leading-relaxed">{docket.description}</p>
            </div>
          )}

          {summaryTable("Labour summary", labourItems, [{ key: "name", label: "Person" }, { key: "role", label: "Role" }, { key: "hours", label: "Hours" }, { key: "rate", label: "Rate" }])}
          {summaryTable("Plant summary", plantItems, [{ key: "role", label: "Plant item" }, { key: "hours", label: "Hours" }, { key: "rate", label: "Rate" }])}
          {summaryTable("Materials summary", materialItems, [{ key: "role", label: "Material" }, { key: "qty", label: "Quantity" }, { key: "rate", label: "Rate" }])}
          {summaryTable("Other", customItems, [{ key: "role", label: "Item" }, { key: "qty", label: "Quantity" }, { key: "rate", label: "Rate" }])}

          <div className="flex justify-between text-[16px] pt-3 border-t-2 border-[#0a1722] mb-6">
            <span className="font-bold text-[#0a1722]">Total</span>
            <span className="font-bold text-[#0a1722]">${docket.total_cost.toLocaleString()}</span>
          </div>

          {alreadySigned ? (
            <div className="bg-green-50 border border-green-100 rounded-xl px-5 py-4 text-center">
              <p className="font-bold text-green-800">Signed by {docket.signed_by_name}</p>
              <p className="text-[13px] text-green-700 mt-1">
                {docket.signed_at && new Date(docket.signed_at).toLocaleString("en-AU")}
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-[#5a6a78] mb-3">Please review the details above and sign to confirm this record of work.</p>
              <DocketSignForm token={token} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
