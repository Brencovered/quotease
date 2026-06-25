export interface Client {
  id: string;
  profile_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  abn: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined from quotes
  job_count?: number;
  total_spent?: number;
  last_job_at?: string | null;
}
