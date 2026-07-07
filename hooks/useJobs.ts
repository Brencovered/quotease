"use client";

import { useQuery } from "@tanstack/react-query";
import { getQueryKey } from "@/lib/queryClient";

export type Job = {
  id: string;
  job_number: number;
  client_name: string | null;
  site_address: string | null;
  total_cost: number | null;
  amount_paid: number | null;
  status: string;
  source: string;
  scheduled_date: string | null;
  scheduled_start: string | null;
};

export function useJobs(businessId?: string) {
  return useQuery({
    queryKey: getQueryKey("jobs", businessId),
    queryFn: async () => {
      const res = await fetch("/api/jobs/list");
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      return (data.jobs ?? []) as Job[];
    },
    enabled: !!businessId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useQuotes(businessId?: string) {
  return useQuery({
    queryKey: getQueryKey("quotes", businessId),
    queryFn: async () => {
      const res = await fetch("/api/jobs/list");
      if (!res.ok) throw new Error("Failed to load quotes");
      const data = await res.json();
      return (data.listJobs ?? []) as Job[];
    },
    enabled: !!businessId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useBoardColumns(businessId?: string) {
  return useQuery({
    queryKey: getQueryKey("board-columns", businessId),
    queryFn: async () => {
      const res = await fetch("/api/jobs/board-columns");
      if (!res.ok) throw new Error("Failed to load columns");
      const data = await res.json();
      return (data.columns ?? []) as Array<{ id: string; label: string; color: string; statuses: string[]; sort_order: number }>;
    },
    enabled: !!businessId,
    staleTime: 1000 * 60 * 5,
  });
}
