export type DocketStatus = "draft" | "sent" | "signed" | "invoiced";
export type DocketItemCategory = "labour" | "plant" | "material" | "custom";
export type DocketRateCategory = "labour" | "plant";

/** The tradie's saved catalog of labour roles / plant items they charge builders or contractors for. */
export interface DocketRateItem {
  id: string;
  profile_id: string;
  category: DocketRateCategory;
  label: string;
  default_rate: number;
  unit: string;
  created_at: string;
}

/** One line on a docket - a person's hours, a plant item's hours, a material, or a custom one-off entry. */
export interface DocketItem {
  id: string;
  docket_id: string;
  profile_id: string;
  category: DocketItemCategory;
  source_rate_item_id: string | null;
  label: string;
  person_name: string | null;
  start_time: string | null;
  end_time: string | null;
  quantity: number;
  rate: number;
  line_total: number; // generated: quantity * rate
  sort_order: number;
  created_at: string;
}

export type DocketInvoiceStatus = "draft" | "sent" | "paid";

/** One EOM bundle: every signed docket rolled into a single invoice for a job. */
export interface DocketInvoice {
  id: string;
  job_id: string;
  profile_id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  docket_count: number;
  total_cost: number;
  status: DocketInvoiceStatus;
  xero_invoice_id: string | null;
  xero_exported_at: string | null;
  created_at: string;
}

/** The docket header. total_cost is trigger-maintained from the sum of its items. */
export interface Docket {
  id: string;
  job_id: string;
  profile_id: string;
  work_date: string; // date, YYYY-MM-DD
  description: string | null;
  weather: string | null;
  client_name: string | null; // who's on site / signing, distinct from the job's client
  client_email: string | null; // where the signing link gets sent
  start_time: string | null;
  end_time: string | null;
  total_cost: number;
  status: DocketStatus;
  public_token: string;
  signed_by_name: string | null;
  signature_data: string | null;
  signed_at: string | null;
  sent_at: string | null;
  invoiced_at: string | null;
  docket_invoice_id: string | null;
  created_at: string;
  updated_at: string;
  items?: DocketItem[];
}
