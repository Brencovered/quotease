/**
 * Server-side caching utilities for Supabase data.
 * Uses Next.js unstable_cache for automatic revalidation.
 *
 * Price-book data, board columns and team context change rarely
 * (user edits them manually), so a 5-minute TTL is safe.
 * After any write, the page router.refresh() invalidates the
 * client-side cache and the next server hit fetches fresh data.
 *
 * IMPORTANT: these functions create their own admin Supabase client
 * internally rather than receiving the caller's client as a parameter.
 * unstable_cache incorporates a serialization of every argument into
 * its cache key - passing a live Supabase client object in (as the
 * original version of this file did) means a complex, non-serializable
 * object with no bearing on what should actually be cached becomes
 * part of the key, which is a well-known unstable_cache footgun (silent
 * cache-key weirdness, not a caught error). Every query here already
 * filters explicitly by profile_id (businessId), which is the ONLY
 * thing that should differentiate cache entries - using an admin
 * client to run them is safe specifically because that businessId was
 * already correctly resolved (via getActiveBusinessId) before it ever
 * reaches these functions, and every query re-applies that filter
 * itself rather than relying on RLS to scope it.
 */

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/* ------------------------------------------------------------------ */
/*  Price book items (the biggest payload on the new-quote page)       */
/* ------------------------------------------------------------------ */
export const getCachedPriceBook = unstable_cache(
  async (businessId: string, trade: string) => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("price_book_items")
      .select("id,description,cost_price")
      .eq("profile_id", businessId)
      .eq("trade", trade)
      .order("description")
      .limit(2000);

    if (error) {
      console.error("getCachedPriceBook error:", error.message);
      return [];
    }
    return data ?? [];
  },
  ["price-book"],
  { revalidate: 300 } // 5 minutes
);

/* ------------------------------------------------------------------ */
/*  Legacy material_items (fallback when price_book is empty)          */
/* ------------------------------------------------------------------ */
export const getCachedLegacyMaterials = unstable_cache(
  async (businessId: string, trade: string) => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("material_items")
      .select("*")
      .eq("profile_id", businessId)
      .eq("trade", trade)
      .order("label");

    if (error) {
      console.error("getCachedLegacyMaterials error:", error.message);
      return [];
    }
    return data ?? [];
  },
  ["legacy-materials"],
  { revalidate: 300 }
);

/* ------------------------------------------------------------------ */
/*  Pricing tiers                                                      */
/* ------------------------------------------------------------------ */
export const getCachedPricingTiers = unstable_cache(
  async (businessId: string) => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("pricing_tiers")
      .select("id, name, markup_pct, sort_order")
      .eq("profile_id", businessId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("getCachedPricingTiers error:", error.message);
      return [];
    }
    return data ?? [];
  },
  ["pricing-tiers"],
  { revalidate: 300 }
);

/* ------------------------------------------------------------------ */
/*  Job size tiers                                                     */
/* ------------------------------------------------------------------ */
export const getCachedJobSizeTiers = unstable_cache(
  async (businessId: string) => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("job_size_tiers")
      .select("id, name, max_days, markup_pct, sort_order")
      .eq("profile_id", businessId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("getCachedJobSizeTiers error:", error.message);
      return [];
    }
    return data ?? [];
  },
  ["job-size-tiers"],
  { revalidate: 300 }
);

/* ------------------------------------------------------------------ */
/*  Board columns (seeding handled inside the cached fn)               */
/* ------------------------------------------------------------------ */
import { getOrSeedBoardColumns, type BoardColumn } from "./jobBoard";

export const getCachedBoardColumns = unstable_cache(
  async (profileId: string): Promise<BoardColumn[]> => {
    const supabase = createAdminClient();
    return getOrSeedBoardColumns(supabase, profileId);
  },
  ["board-columns"],
  { revalidate: 60 } // 1 minute — columns change more often
);

/* ------------------------------------------------------------------ */
/*  Profile (lightweight — just the fields we need)                    */
/* ------------------------------------------------------------------ */
export const getCachedProfile = unstable_cache(
  async (businessId: string) => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("hourly_rate, materials_margin_pct, trades, onboarded_at, business_name, abn, license_number, business_address, contact_phone, terms_and_conditions, logo_url, contact_email, default_deposit_pct, default_expiry_days, hourly_rate, materials_margin_pct")
      .eq("id", businessId)
      .single();

    if (error) {
      console.error("getCachedProfile error:", error.message);
      return null;
    }
    return data;
  },
  ["profile"],
  { revalidate: 300 }
);
