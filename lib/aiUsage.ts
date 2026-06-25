// 3 free drawing analyses per account, lifetime - lets every tradie try the
// feature before paying. Beyond that, the $10/mo add-on covers 20/month.
export const FREE_ANALYSES_LIMIT = 3;
export const ADDON_MONTHLY_LIMIT = 20;
export const ADDON_PRICE_LABEL = "$10/mo for 20 drawing analyses";

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface UsageProfile {
  ai_free_analyses_used: number;
  ai_addon_status: string;
  ai_addon_period: string | null;
  ai_addon_analyses_used: number;
}

export type UsageCheckResult =
  | { allowed: true; via: "free" | "addon"; remainingFree?: number; remainingAddon?: number }
  | { allowed: false; reason: string };

// Pure decision logic, kept separate from the DB calls so it's easy to test
// and easy to reason about without tracing through Supabase round-trips.
export function checkUsage(profile: UsageProfile): UsageCheckResult {
  if (profile.ai_free_analyses_used < FREE_ANALYSES_LIMIT) {
    return { allowed: true, via: "free", remainingFree: FREE_ANALYSES_LIMIT - profile.ai_free_analyses_used - 1 };
  }

  if (profile.ai_addon_status === "active") {
    const periodMatches = profile.ai_addon_period === currentPeriod();
    const usedThisPeriod = periodMatches ? profile.ai_addon_analyses_used : 0;
    if (usedThisPeriod < ADDON_MONTHLY_LIMIT) {
      return { allowed: true, via: "addon", remainingAddon: ADDON_MONTHLY_LIMIT - usedThisPeriod - 1 };
    }
    return {
      allowed: false,
      reason: `You've used all ${ADDON_MONTHLY_LIMIT} drawing analyses included this month. Resets on the 1st.`,
    };
  }

  return {
    allowed: false,
    reason: `You've used your ${FREE_ANALYSES_LIMIT} free drawing analyses. Subscribe to the AI add-on (${ADDON_PRICE_LABEL}) to keep using this.`,
  };
}
