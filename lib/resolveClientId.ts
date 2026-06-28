import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveClientId(
  supabase: SupabaseClient,
  profileId: string,
  clientId: string | null,
  clientName: string,
  clientEmail: string,
  siteAddress: string
): Promise<string | null> {
  if (clientId) return clientId;
  if (!clientName.trim()) return null;

  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", profileId)
    .ilike("name", clientName.trim())
    .maybeSingle();
  if (existingClient) return existingClient.id;

  const { data: newClient } = await supabase
    .from("clients")
    .insert({
      profile_id: profileId,
      name: clientName.trim(),
      email: clientEmail.trim() || null,
      billing_address: siteAddress.trim() || null,
    })
    .select("id")
    .single();
  return newClient?.id ?? null;
}
