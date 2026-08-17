import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import VariationRespondForm from "@/components/VariationRespondForm";
import SafeLogoImage from "@/components/SafeLogoImage";

export default async function PublicVariationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: variation } = await supabase
    .from("variations")
    .select(
      "id, title, description, labour_hours, materials_cost, total_cost, status, client_approved_at, client_signer_name, profiles!variations_profile_id_fkey(business_name, logo_url, contact_phone), jobs(job_number, client_name, site_address)"
    )
    .eq("public_token", token)
    .single();

  if (!variation) notFound();

  const profile = variation.profiles as unknown as {
    business_name?: string | null;
    logo_url?: string | null;
    contact_phone?: string | null;
  } | null;
  const job = variation.jobs as unknown as {
    job_number?: number;
    client_name?: string | null;
    site_address?: string | null;
  } | null;

  return (
    <main className="min-h-screen bg-[#f4f6f8] py-10 px-4">
      <div className="max-w-lg mx-auto bg-white border border-[#e8ecef] rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-[#0a1722] px-6 py-6">
          {profile?.logo_url && (
            <SafeLogoImage src={profile.logo_url} alt={profile.business_name ?? ""} className="h-10 mb-3 object-contain" />
          )}
          <p className="font-display text-xl text-white">{profile?.business_name ?? "Variation"}</p>
          {profile?.contact_phone && (
            <p className="text-[12.5px] text-[#a9bcc8] mt-1">{profile.contact_phone}</p>
          )}
        </div>
        <div className="p-6">
          <p className="text-[11px] tracking-[.1em] uppercase text-[#b45309] font-bold mb-2">Variation</p>
          <h1 className="font-display text-2xl text-[#0a1722] mb-1">{variation.title}</h1>
          {job?.job_number != null && (
            <p className="text-[13px] text-[#64748b] mb-3">
              Job #{job.job_number}
              {job.client_name ? ` · ${job.client_name}` : ""}
              {job.site_address ? ` · ${job.site_address}` : ""}
            </p>
          )}
          {variation.description && (
            <p className="text-[14px] text-[#334155] mb-4 whitespace-pre-wrap">{variation.description}</p>
          )}
          <div className="rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-4 mb-5">
            <div className="flex justify-between text-[13px] text-[#64748b] mb-1">
              <span>Labour</span>
              <span>{variation.labour_hours}h</span>
            </div>
            <div className="flex justify-between text-[13px] text-[#64748b] mb-2">
              <span>Materials</span>
              <span>${Number(variation.materials_cost ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-[#e2e8f0] pt-2">
              <span className="font-bold text-[#0a1722]">Total</span>
              <span className="font-display text-xl text-[#0a1722]">
                ${Number(variation.total_cost ?? 0).toLocaleString()}
              </span>
            </div>
          </div>

          {variation.status === "pending" ? (
            <VariationRespondForm
              token={token}
              title={variation.title}
              amount={Number(variation.total_cost ?? 0)}
            />
          ) : (
            <div
              className={`rounded-xl px-4 py-3 text-center ${
                variation.status === "approved"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              <p className="font-bold capitalize">{variation.status}</p>
              {variation.client_signer_name && (
                <p className="text-[13px] mt-1">by {variation.client_signer_name}</p>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-center text-[11.5px] text-[#94a3b8] mt-4">Quoting by Swiftscope</p>
    </main>
  );
}
