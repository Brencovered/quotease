import type { SupabaseClient } from "@supabase/supabase-js";

export interface BoardColumn {
  id: string;
  label: string;
  color: string;
  statuses: string[];
  sort_order: number;
}

export const ALL_JOB_STATUSES = [
  "scheduled", "in_progress", "on_hold", "awaiting_sign_off",
  "complete", "invoiced", "partially_paid", "archived", "cancelled",
];

const DEFAULT_COLUMNS: Array<{ label: string; color: string; statuses: string[] }> = [
  { label: "Scheduled", color: "gray", statuses: ["scheduled"] },
  { label: "In progress", color: "blue", statuses: ["in_progress", "on_hold"] },
  { label: "Complete", color: "green", statuses: ["complete", "awaiting_sign_off"] },
  { label: "Invoiced", color: "amber", statuses: ["invoiced", "partially_paid"] },
];

/** Fetch this business's board columns, seeding the defaults on first use. */
export async function getOrSeedBoardColumns(supabase: SupabaseClient, profileId: string): Promise<BoardColumn[]> {
  const { data } = await supabase.from("job_board_columns").select("*").eq("profile_id", profileId).order("sort_order");
  if (data && data.length > 0) return data as BoardColumn[];

  const seeded = DEFAULT_COLUMNS.map((c, i) => ({ profile_id: profileId, label: c.label, color: c.color, statuses: c.statuses, sort_order: i }));
  const { data: created } = await supabase.from("job_board_columns").insert(seeded).select("*").order("sort_order");
  return (created as BoardColumn[]) ?? [];
}
