import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { termAmount, type PaymentTerm } from "@/lib/paymentTerms";
import QuoteResponseButtons from "@/components/QuoteResponseButtons";
import { humanizeIntakePublic } from "@/lib/humanizeIntake";

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, public_token, client_name, site_address, trade, job_type, labour_hours, materials_cost, total_cost, payment_terms, status, intake_data, profiles!quotes_profile_id_fkey(business_name, logo_url, contact_phone, abn, license_number, business_address, bank_account_name, bank_bsb, bank_account_number, accepts_cash)"
    )
    .eq("public_token", token)
    .single();

  if (!quote) notFound();

  const profile = quote.profiles as unknown as {
    business_name?: string;
    logo_url?: string | null;
    contact_phone?: string | null;
    abn?: string | null;
    license_number?: string | null;
    business_address?: string | null;
    bank_account_name?: string | null;
    bank_bsb?: string | null;
    bank_account_number?: string | null;
    accepts_cash?: boolean;
  };

  const terms: PaymentTerm[] = quote.payment_terms ?? [
    { label: "Payment due", percent: 100, trigger: "completion", days: 14 },
  ];
  const hasBankDetails = !!(profile.bank_bsb && profile.bank_account_number);

  const scopeLines = humanizeIntakePublic(quote.intake_data as Record<string, unknown> | null);

  return (
    <main className="min-h-screen bg-[var(--app-bg)] py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-[var(--navy)] px-6 py-6">
            {profile.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logo_url} alt={profile.business_name ?? ""} className="h-10 mb-3 object-contain" />
            )}
            <p className="font-display text-xl text-white">{profile.business_name ?? "Quote"}</p>
            <p className="text-[12.5px] text-[var(--steel-1)] mt-1">
              {[profile.business_address, profile.abn ? `ABN ${profile.abn}` : null, profile.license_number ? `Licence ${profile.license_number}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className="p-6">
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <p className="text-[12px] text-[var(--ink-faint)]">Quote for {quote.client_name}</p>
                <p className="text-[13px] text-[var(--ink-faint)]">{quote.site_address}</p>
              </div>
              <p className="font-display text-3xl text-[var(--ink)]">${(quote.total_cost ?? 0).toLocaleString()}</p>
            </div>

            {scopeLines.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] tracking-[.1em] uppercase text-[var(--amber-deep)] font-bold mb-2">Scope of works</p>
                <ul className="space-y-1">
                  {scopeLines.map((l) => (
                    <li key={l} className="text-[13.5px] text-[var(--ink-soft)]">• {l}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-5">
              <p className="text-[11px] tracking-[.1em] uppercase text-[var(--amber-deep)] font-bold mb-2">Quote summary</p>
              <div className="flex justify-between text-[14px] py-1">
                <span className="text-[var(--ink-soft)]">Labour ({quote.labour_hours ?? 0} hrs)</span>
                <span className="font-semibold text-[var(--ink)]">${((quote.total_cost ?? 0) - (quote.materials_cost ?? 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[14px] py-1">
                <span className="text-[var(--ink-soft)]">Materials</span>
                <span className="font-semibold text-[var(--ink)]">${(quote.materials_cost ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[15px] py-2 border-t border-[var(--line)] mt-1">
                <span className="font-bold text-[var(--ink)]">Total</span>
                <span className="font-display text-lg text-[var(--ink)]">${(quote.total_cost ?? 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-[11px] tracking-[.1em] uppercase text-[var(--amber-deep)] font-bold mb-2">Payment terms</p>
              {terms.map((t, i) => (
                <div key={i} className="flex justify-between text-[13.5px] py-0.5">
                  <span className="text-[var(--ink-soft)]">{t.label} ({t.percent}%)</span>
                  <span className="font-semibold text-[var(--ink)]">${termAmount(t, quote.total_cost ?? 0).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {(hasBankDetails || profile.accepts_cash) && (
              <div className="mb-5 bg-[var(--app-bg)] rounded-xl p-3">
                <p className="text-[11px] tracking-[.1em] uppercase text-[var(--amber-deep)] font-bold mb-2">How to pay</p>
                {hasBankDetails && (
                  <p className="text-[12.5px] text-[var(--ink-soft)] mb-1">
                    Bank transfer: {profile.bank_account_name ?? profile.business_name} - BSB {profile.bank_bsb}, Acc {profile.bank_account_number}
                  </p>
                )}
                {profile.accepts_cash && <p className="text-[12.5px] text-[var(--ink-soft)]">Cash accepted on completion.</p>}
              </div>
            )}

            <a
              href={`/api/q/${token}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[13px] font-semibold text-[var(--navy)] underline mb-5"
            >
              Download PDF
            </a>

            <QuoteResponseButtons
              token={token}
              status={quote.status}
              totalCost={quote.total_cost ?? 0}
              paymentTerms={terms}
              hasBankDetails={hasBankDetails}
              bankName={profile.bank_account_name}
              bankBsb={profile.bank_bsb}
              bankAccount={profile.bank_account_number}
              acceptsCash={profile.accepts_cash}
              businessName={profile.business_name}
            />
          </div>
        </div>
        <p className="text-center text-[11.5px] text-[var(--ink-faint)] mt-4">Quoting by Quotease</p>
      </div>
    </main>
  );
}
