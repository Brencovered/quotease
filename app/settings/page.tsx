import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  let profile: { business_name?: string; contact_email?: string; xero_connected?: boolean } | null = null;

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

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-xl font-medium mb-6">Settings</h1>

      <div className="border rounded-lg p-4 mb-4">
        <p className="font-medium text-sm mb-1">Accounting</p>
        {profile?.xero_connected ? (
          <p className="text-sm text-green-700">Connected to Xero</p>
        ) : (
          <>
            <p className="text-sm text-neutral-500 mb-3">
              Connect Xero to push accepted quotes as draft invoices automatically.
            </p>
            <a
              href="/api/xero/connect"
              className="inline-block bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium"
            >
              Connect Xero
            </a>
          </>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <p className="font-medium text-sm mb-1">Business</p>
        <p className="text-sm text-neutral-500">{profile?.business_name ?? "Not signed in — demo view"}</p>
        <p className="text-sm text-neutral-500">{profile?.contact_email ?? ""}</p>
      </div>
    </main>
  );
}
