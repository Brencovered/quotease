export type DocketStatus = "draft" | "sent" | "signed" | "invoiced";

export interface Docket {
  id: string;
  job_id: string;
  profile_id: string;
  work_date: string; // date, YYYY-MM-DD
  description: string | null;
  labour_hours: number;
  hourly_rate: number;
  minimum_hours: number;
  materials_cost: number;
  billed_hours: number; // generated: greatest(labour_hours, minimum_hours)
  total_cost: number; // generated: billed_hours * hourly_rate + materials_cost
  status: DocketStatus;
  public_token: string;
  signed_by_name: string | null;
  signature_data: string | null; // base64 PNG data URL
  signed_at: string | null;
  invoiced_at: string | null;
  created_at: string;
  updated_at: string;
}

/** What the "log a docket" form actually needs to submit - the rest is server/DB-computed. */
export interface DocketDraftInput {
  job_id: string;
  work_date: string;
  description: string;
  labour_hours: number;
  hourly_rate: number;
  minimum_hours: number;
  materials_cost: number;
}
