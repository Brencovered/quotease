import { createClient } from "@/lib/supabase/server";
import SettingsPanel from "@/components/SettingsPanel";

export default async function SettingsPage() {
  let profile: {
    business_name?: string;
    contact_email?: string;
    xero_connected?: boolean;
    trades?: string[];
  } | null = null;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
      profile = data;
    }
  } catch (err) {
    console.error("Settings page: continuing without profile data —", err);
  }

  return <SettingsPanel profile={profile} />;
}
