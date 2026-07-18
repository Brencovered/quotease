/**
 * lib/abnLookup.ts
 * -----------------
 * Verifies an ABN against the Australian Business Register's free ABN
 * Lookup API (https://abr.business.gov.au). Requires a free GUID, register
 * at https://abr.business.gov.au/Tools/WebServices and set ABN_LOOKUP_GUID.
 *
 * Not configured yet -- verifyAbn() returns { valid: false, configured: false }
 * until ABN_LOOKUP_GUID is set, so the claim flow degrades to "unverified"
 * rather than throwing when this env var is missing (same pattern as the
 * Google Service Account Key gap noted elsewhere in the roadmap).
 */

const ABN_LOOKUP_GUID = process.env.ABN_LOOKUP_GUID;

export interface AbnVerificationResult {
  configured: boolean;
  valid: boolean;
  active?: boolean;
  entityName?: string;
  error?: string;
}

export async function verifyAbn(abn: string): Promise<AbnVerificationResult> {
  if (!ABN_LOOKUP_GUID) {
    return { configured: false, valid: false };
  }

  const cleanAbn = abn.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(cleanAbn)) {
    return { configured: true, valid: false, error: "ABN must be 11 digits" };
  }

  try {
    const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${cleanAbn}&guid=${ABN_LOOKUP_GUID}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { configured: true, valid: false, error: "ABN Lookup service unavailable" };
    }

    // The endpoint returns JSONP-ish text (callback(...)) rather than pure
    // JSON by default -- strip a wrapping function call if present.
    const text = await res.text();
    const jsonText = text.replace(/^[^(]*\(/, "").replace(/\)\s*;?\s*$/, "");
    const data = JSON.parse(jsonText);

    if (data.Message) {
      // The API returns a Message field (not an HTTP error) for an invalid/
      // not-found ABN, e.g. "ABN Invalid abn format" or "No entity found."
      return { configured: true, valid: false, error: data.Message };
    }

    const active = data.AbnStatus === "Active";
    return {
      configured: true,
      valid: true,
      active,
      entityName: data.EntityName ?? data.MainName?.OrganisationName ?? undefined,
    };
  } catch (err) {
    console.error("[abnLookup] verification failed:", err);
    return { configured: true, valid: false, error: "Could not reach ABN Lookup" };
  }
}
