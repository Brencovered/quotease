/**
 * ASIC Company Dataset (data.gov.au, package asic-companies).
 *
 * The weekly file is a tab-separated snapshot inside company_YYYYMM.zip.
 * CC BY 3.0 AU. Keep the attribution next to any UI that shows the rows.
 *
 * The download URL changes every week. Call the CKAN package API and
 * pick the newest zip. Do not hardcode company_202611.zip.
 */

import { matchTrade } from "@/lib/abnBulkIngest";

export const ASIC_PACKAGE_URL = "https://data.gov.au/data/api/3/action/package_show?id=asic-companies";

export const ASIC_MIGRATION_HINT =
  "Apply supabase/migrations/20261116015756_asic_company_candidates.sql to store ASIC company source, ACN, and registration date. It does not delete rows.";

export const ASIC_ATTRIBUTION =
  "Contains ASIC company data, © Commonwealth of Australia, licensed under CC BY 3.0 AU. Source: ASIC Company Dataset, data.gov.au.";

export interface AsicResource {
  format?: string | null;
  url?: string | null;
  last_modified?: string | null;
}

export interface AsicCompany {
  companyName: string;
  acn: string;
  status: string;
  registeredOn: string;
  previousState: string | null;
  currentName: boolean;
  abn: string | null;
  type: string | null;
}

export interface AsicCandidateDraft {
  abn: string | null;
  acn: string;
  legal_name: string;
  matched_trade: string;
  state: string | null;
  entity_type: string | null;
  source: "asic_company";
  registered_at: string;
}

export interface ExistingCandidate {
  abn: string | null;
  acn: string | null;
  processed: boolean;
}

export interface AsicQueuePlan {
  insert: AsicCandidateDraft[];
  refreshAbns: AsicCandidateDraft[];
}

export function pickAsicZipUrl(resources: AsicResource[]): string {
  const zips = resources.filter((resource) => {
    const format = (resource.format ?? "").toLowerCase();
    const url = resource.url ?? "";
    return format === "zip" && /company_\d+\.zip(?:\?|$)/i.test(url);
  });
  zips.sort((a, b) => (b.last_modified ?? "").localeCompare(a.last_modified ?? ""));
  const url = zips[0]?.url;
  if (!url) {
    throw new Error("CKAN package asic-companies did not include a company_YYYYMM.zip resource.");
  }
  return url;
}

export function asicLookbackDays(env: Record<string, string | undefined>, hasExistingAsicRows: boolean): number {
  const explicit = positiveInt(env.ASIC_LOOKBACK_DAYS);
  if (explicit) return explicit;
  if (!hasExistingAsicRows) return positiveInt(env.ASIC_FIRST_RUN_LOOKBACK_DAYS) ?? 90;
  return 30;
}

export function registrationCutoff(today: Date, days: number): string {
  const cutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return cutoff.toISOString().slice(0, 10);
}

export function headerIndex(headerLine: string): Map<string, number> {
  const index = new Map<string, number>();
  headerLine.split("\t").forEach((name, position) => {
    index.set(name.trim().toLowerCase(), position);
  });
  return index;
}

export function parseAsicRow(line: string, columns: Map<string, number>): AsicCompany | null {
  if (!line.includes("\t")) return null;
  const fields = line.split("\t");
  const read = (name: string) => (fields[columns.get(name) ?? -1] ?? "").trim();
  const companyName = read("company name");
  const acn = digits(read("acn"));
  const registeredOn = isoDate(read("date of registration"));
  if (!companyName || acn.length !== 9 || !registeredOn) return null;
  const abnDigits = digits(read("abn"));
  return {
    companyName,
    acn,
    status: read("status").toUpperCase(),
    registeredOn,
    previousState: read("previous state of registration") || null,
    currentName: read("current name indicator").toUpperCase() === "Y",
    abn: abnDigits.length === 11 ? abnDigits : null,
    type: read("type") || null,
  };
}

export function toCandidate(company: AsicCompany, cutoff: string): AsicCandidateDraft | null {
  if (!company.currentName) return null;
  if (company.status !== "REGD") return null;
  if (company.registeredOn < cutoff) return null;
  const trade = matchTrade({ legalName: company.companyName, tradingName: null });
  if (!trade) return null;
  return {
    abn: company.abn,
    acn: company.acn,
    legal_name: company.companyName,
    matched_trade: trade,
    state: company.previousState,
    entity_type: company.type,
    source: "asic_company",
    registered_at: company.registeredOn,
  };
}

export function planAsicQueue(
  drafts: AsicCandidateDraft[],
  existing: ExistingCandidate[],
  listingAbns: Set<string>,
): AsicQueuePlan {
  const byAbn = new Map<string, ExistingCandidate>();
  const byAcn = new Map<string, ExistingCandidate>();
  for (const row of existing) {
    if (row.abn) byAbn.set(row.abn, row);
    if (row.acn) byAcn.set(row.acn, row);
  }

  const plan: AsicQueuePlan = { insert: [], refreshAbns: [] };
  const seenAbn = new Set<string>();
  const seenAcn = new Set<string>();

  for (const draft of drafts) {
    if (draft.abn && listingAbns.has(draft.abn)) continue;
    if (draft.abn && seenAbn.has(draft.abn)) continue;
    if (seenAcn.has(draft.acn)) continue;
    const prior = (draft.abn && byAbn.get(draft.abn)) || byAcn.get(draft.acn);
    if (prior?.processed) continue;
    if (prior) {
      plan.refreshAbns.push(draft);
      continue;
    }
    if (draft.abn) seenAbn.add(draft.abn);
    seenAcn.add(draft.acn);
    plan.insert.push(draft);
  }
  return plan;
}

function positiveInt(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function isoDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}
