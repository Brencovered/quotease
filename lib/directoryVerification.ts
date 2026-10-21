/**
 * Re-check directory listings with free sources only:
 *   - ABN Lookup (ABR web service) for whether an ABN is active
 *   - DNS MX lookup for the outreach email
 *
 * Nothing here sends email or calls Google Places. A row is due when it
 * has never been checked, or verified_at is older than 90 days. A
 * transient failure (DNS timeout, ABN GUID missing) does not start the
 * 90-day clock.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyAbn, type AbnVerificationResult } from "@/lib/abnLookup";
import { lookupEmailMx, type MxResult } from "@/lib/emailMx";

export const VERIFICATION_MAX_AGE_DAYS = 90;
const PAGE = 400;
const MX_CONCURRENCY = 8;

export function verificationCutoff(now = Date.now()): string {
  return new Date(now - VERIFICATION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function outreachEmail(row: {
  scraped_contact_email?: string | null;
  private_email?: string | null;
}): string | null {
  const scraped = row.scraped_contact_email?.trim();
  if (scraped) return scraped;
  const priv = row.private_email?.trim();
  return priv || null;
}

export interface VerificationPatch {
  email_valid: boolean | null;
  verified_at: string | null;
  verification_source: string | null;
}

export function buildVerificationPatch(input: {
  mx: MxResult | null;
  abn: Pick<AbnVerificationResult, "configured" | "valid" | "active"> | null;
  now?: string;
}): VerificationPatch {
  const parts: string[] = [];
  let emailValid: boolean | null = null;
  let transient = false;

  if (input.mx === "valid") {
    emailValid = true;
    parts.push("mx:valid");
  } else if (input.mx === "invalid") {
    emailValid = false;
    parts.push("mx:invalid");
  } else if (input.mx === "unknown") {
    transient = true;
    parts.push("mx:unknown");
  }

  if (input.abn) {
    if (!input.abn.configured) {
      transient = true;
      parts.push("abn_lookup:unconfigured");
    } else if (!input.abn.valid) {
      parts.push("abn_lookup:invalid");
    } else if (input.abn.active) {
      parts.push("abn_lookup:active");
    } else {
      parts.push("abn_lookup:inactive");
    }
  }

  return {
    email_valid: emailValid,
    verified_at: transient ? null : (input.now ?? new Date().toISOString()),
    verification_source: parts.length > 0 ? parts.join(",") : null,
  };
}

export interface ListingToVerify {
  id: string;
  abn: string | null;
  scraped_contact_email: string | null;
  private_email: string | null;
}

export interface DirectoryVerificationResult {
  examined: number;
  verified: number;
  emailValid: number;
  emailInvalid: number;
  abnActive: number;
  abnInactive: number;
  deferred: number;
}

let nextAbnSlot = 0;

async function paceAbnLookup() {
  const now = Date.now();
  const wait = Math.max(0, nextAbnSlot - now);
  nextAbnSlot = Math.max(now, nextAbnSlot) + 200;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

export async function verifyOneListing(row: ListingToVerify, now = new Date().toISOString()): Promise<VerificationPatch> {
  const email = outreachEmail(row);
  const mx = email ? await lookupEmailMx(email) : null;
  let abn: AbnVerificationResult | null = null;
  if (row.abn) {
    await paceAbnLookup();
    abn = await verifyAbn(row.abn);
  }
  return buildVerificationPatch({ mx, abn, now });
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function runDirectoryVerification(
  admin: SupabaseClient,
  options?: { limit?: number },
): Promise<DirectoryVerificationResult> {
  const limit = options?.limit ?? 2000;
  const cutoff = verificationCutoff();
  const result: DirectoryVerificationResult = {
    examined: 0,
    verified: 0,
    emailValid: 0,
    emailInvalid: 0,
    abnActive: 0,
    abnInactive: 0,
    deferred: 0,
  };

  let from = 0;
  const pending: ListingToVerify[] = [];
  while (pending.length < limit) {
    const { data, error } = await admin
      .from("directory_listing")
      .select("id, abn, scraped_contact_email, private_email, verified_at")
      .or(`verified_at.is.null,verified_at.lt.${cutoff}`)
      .order("verified_at", { ascending: true, nullsFirst: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    for (const row of page) {
      if (!row.abn && !outreachEmail(row)) continue;
      pending.push(row as ListingToVerify);
      if (pending.length >= limit) break;
    }
    if (page.length < PAGE) break;
    from += PAGE;
  }

  const now = new Date().toISOString();
  const patches = await mapPool(pending, MX_CONCURRENCY, (row) => verifyOneListing(row, now));

  for (let i = 0; i < pending.length; i++) {
    const row = pending[i];
    const patch = patches[i];
    result.examined += 1;
    if (patch.email_valid === true) result.emailValid += 1;
    if (patch.email_valid === false) result.emailInvalid += 1;
    if (patch.verification_source?.includes("abn_lookup:active")) result.abnActive += 1;
    if (patch.verification_source?.includes("abn_lookup:inactive") || patch.verification_source?.includes("abn_lookup:invalid")) {
      result.abnInactive += 1;
    }
    if (!patch.verified_at) {
      result.deferred += 1;
      if (patch.email_valid == null && !patch.verification_source) continue;
    } else {
      result.verified += 1;
    }

    const { error } = await admin
      .from("directory_listing")
      .update({
        email_valid: patch.email_valid,
        verified_at: patch.verified_at,
        verification_source: patch.verification_source,
      })
      .eq("id", row.id);
    if (error) console.error(`[directoryVerification] update ${row.id} failed:`, error.message);
  }

  return result;
}
