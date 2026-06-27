import { createClient } from "@/lib/supabase/server";
import SettingsPanel from "@/components/SettingsPanel";
import AppHeader from "@/components/AppHeader";

export default async function SettingsPage() {
  let profile: {
    business_name?: string;
    contact_email?: string;
    xero_connected?: boolean;
    trades?: string[];
    ai_free_analyses_used?: number;
    ai_addon_status?: string;
    ai_addon_period?: string | null;
    ai_addon_analyses_used?: number;
  } | null = null;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
      profile = data;
    }
  } catch (err) {
    console.error("Settings page: continuing without profile data -", err);
  }

  return (
    <>
      <AppHeader />
      <SettingsPanel profile={profile} />
    </>
  );
}
