import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import DocketSignForm from "@/components/DocketSignForm";

export default async function PublicDocketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: docket } = await supabase
    .from("dockets")
    .select(
      "id, work_date, description, labour_hours, hourly_rate, minimum_hours, materials_cost, billed_hours, total_cost, status, signed_by_name, signed_at, jobs(job_number, title, client_name, site_address, profiles!jobs_profile_id_fkey(business_name, logo_url))"
    )
    .eq("public_token", token)
    .single();

  if (!docket) notFound();

  const job = docket.jobs as unknown as {
    job_number: number;
    title: string | null;
    client_name: string | null;
    site_address: string | null;
    profiles: { business_name?: string; logo_url?: string | null };
  };
  const profile = job?.profiles;

  const alreadySigned = docket.status === "signed" || docket.status === "invoiced";
  const workDate = new Date(docket.work_date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="min-h-screen bg-[#f4f6f7] py-10 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-[#0a1722] px-6 py-5">
          <p className="text-[12px] font-semibold text-[#8aa4b4] uppercase tracking-wide">{profile?.business_name || "Dayworks docket"}</p>
          <p className="text-white font-bold text-[20px] mt-0.5">Job #{job?.job_number}{job?.title ? ` - ${job.title}` : ""}</p>
        </div>

        <div className="px-6 py-6">
          <div className="mb-5 space-y-1">
            <p className="text-[13px] text-[#5a6a78]"><span className="font-semibold text-[#0a1722]">Date of work:</span> {workDate}</p>
            {job?.site_address && <p className="text-[13px] text-[#5a6a78]"><span className="font-semibold text-[#0a1722]">Site:</span> {job.site_address}</p>}
            {job?.client_name && <p className="text-[13px] text-[#5a6a78]"><span className="font-semibold text-[#0a1722]">Client:</span> {job.client_name}</p>}
          </div>

          {docket.description && (
            <div className="bg-[#f8f9fa] rounded-xl px-4 py-3 mb-5">
              <p className="text-[11px] font-bold tracking-wide uppercase text-[#8a9ba8] mb-1">Work done</p>
              <p className="text-[14px] text-[#3a4a58] leading-relaxed">{docket.description}</p>
            </div>
          )}

          <div className="border-t border-[#e8ecef] pt-4 space-y-2 mb-6">
            <div className="flex justify-between text-[13.5px]">
              <span className="text-[#5a6a78]">Hours worked</span>
              <span className="font-semibold text-[#0a1722]">{docket.labour_hours}h</span>
            </div>
            {docket.billed_hours > docket.labour_hours && (
              <div className="flex justify-between text-[13.5px]">
                <span className="text-[#5a6a78]">Billed (min. {docket.minimum_hours}h callout)</span>
                <span className="font-semibold text-[#0a1722]">{docket.billed_hours}h</span>
              </div>
            )}
            <div className="flex justify-between text-[13.5px]">
              <span className="text-[#5a6a78]">Rate</span>
              <span className="font-semibold text-[#0a1722]">${docket.hourly_rate}/h</span>
            </div>
            {docket.materials_cost > 0 && (
              <div className="flex justify-between text-[13.5px]">
                <span className="text-[#5a6a78]">Materials</span>
                <span className="font-semibold text-[#0a1722]">${docket.materials_cost}</span>
              </div>
            )}
            <div className="flex justify-between text-[16px] pt-2 border-t border-[#e8ecef] mt-2">
              <span className="font-bold text-[#0a1722]">Total</span>
              <span className="font-bold text-[#0a1722]">${docket.total_cost}</span>
            </div>
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
