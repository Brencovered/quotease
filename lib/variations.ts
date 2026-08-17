export interface Variation {
  id: string;
  quote_id: string | null;
  job_id?: string | null;
  profile_id: string;
  title: string;
  description: string | null;
  labour_hours: number;
  materials_cost: number;
  total_cost: number;
  status: "pending" | "approved" | "declined";
  client_approved_at: string | null;
  client_signer_name?: string | null;
  public_token?: string | null;
  created_at: string;
}
