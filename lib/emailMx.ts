/**
 * Free email check: DNS MX lookup only. This never opens an SMTP
 * connection and never sends mail.
 */

import { resolveMx } from "node:dns/promises";

export type MxResult = "valid" | "invalid" | "unknown";

export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1).replace(/\.$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || domain.includes("..")) return null;
  return domain;
}

type MxResolver = (domain: string) => Promise<{ exchange: string }[]>;

export async function lookupEmailMx(
  email: string | null | undefined,
  resolve: MxResolver = resolveMx,
): Promise<MxResult> {
  if (!email?.trim()) return "unknown";
  const domain = emailDomain(email);
  if (!domain) return "invalid";
  try {
    const records = await resolve(domain);
    return records.length > 0 ? "valid" : "invalid";
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "ENODOMAIN") return "invalid";
    return "unknown";
  }
}
