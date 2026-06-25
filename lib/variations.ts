export interface Variation {
  id: string;
  quote_id: string;
  profile_id: string;
  title: string;
  description: string | null;
  labour_hours: number;
  materials_cost: number;
  total_cost: number;
  status: "pending" | "approved" | "declined";
  client_approved_at: string | null;
  created_at: string;
}
