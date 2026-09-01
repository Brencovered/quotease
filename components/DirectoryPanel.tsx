"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { Check, Globe } from "lucide-react";

export default function DirectoryPanel({
  profile,
}: {
  profile: {
    directory_enabled: boolean;
    directory_suburb: string | null;
    directory_postcode: string | null;
    directory_bio: string | null;
    directory_website: string | null;
    directory_phone: string | null;
    directory_email: string | null;
  } | null;
}) {
  const [enabled,  setEnabled]  = useState(profile?.directory_enabled ?? false);
  const [suburb,   setSuburb]   = useState(profile?.directory_suburb ?? "");
  const [postcode, setPostcode] = useState(profile?.directory_postcode ?? "");
  const [bio,      setBio]      = useState(profile?.directory_bio ?? "");
  const [website,  setWebsite]  = useState(profile?.directory_website ?? "");
  const [phone,    setPhone]    = useState(profile?.directory_phone ?? "");
  const [email,    setEmail]    = useState(profile?.directory_email ?? "");
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const businessId = await getActiveBusinessId(supabase, user.id);
    await supabase.from("profiles").update({
      directory_enabled:  enabled,
      directory_suburb:   suburb  || null,
      directory_postcode: postcode || null,
      directory_bio:      bio     || null,
      directory_website:  website || null,
      directory_phone:    phone   || null,
      directory_email:    email   || null,
    }).eq("id", businessId);

    // The update above only persists the form's own state - it does NOT
    // put the business on the public directory (directory_listing is a
    // separate table with no owner-scoped RLS, so this has to go through
    // a server route running as admin). Without this call, "Saved" would
    // show even though nothing changed on swiftscope.com.au/directory.
    try {
      const res = await fetch("/api/directory/self-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, suburb, postcode, bio, website, phone, email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Saved your settings, but couldn't update the public listing");
      }
    } catch {
      setError("Saved your settings, but couldn't reach the server to update the public listing");
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="card">
      <p className="section-tag mb-1">Swiftscope Directory</p>
      <p className="font-semibold text-[var(--ink)] mb-1">List your business for free</p>
      <p className="text-[13px] text-[var(--ink-faint)] mb-4">
        Get your business in front of homeowners searching for your trade.
        Your listing appears on the public directory at swiftscope.com.au/directory.
      </p>

      {/* Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--app-bg)] border border-[var(--line)] mb-4">
        <div>
          <p className="font-semibold text-[13.5px] text-[var(--ink)]">
            {enabled ? "Listed in directory" : "Not listed"}
          </p>
          <p className="text-[12px] text-[var(--ink-faint)]">
            {enabled ? "Your business is visible to homeowners" : "Enable to appear in search results"}
          </p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? "bg-[var(--amber)]" : "bg-[var(--line)]"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">Suburb</label>
              <input value={suburb} onChange={e => setSuburb(e.target.value)}
                placeholder="e.g. Seaford" className="app-field text-[13px]" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">Postcode</label>
              <input value={postcode} onChange={e => setPostcode(e.target.value)}
                placeholder="3198" className="app-field text-[13px]" />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">
              About your business <span className="text-[var(--ink-faint)] font-normal">(shown on your listing)</span>
            </label>
            <textarea value={bio} onChange={e => setBio(e.target.value)}
              placeholder="e.g. Licensed electrician serving Melbourne's south east. 10+ years experience in residential and commercial work."
              rows={3} className="app-field text-[13px] resize-none" />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">Contact phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="04XX XXX XXX" className="app-field text-[13px]" />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">Contact email</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="info@yourbusiness.com.au" className="app-field text-[13px]" />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">Website</label>
            <input value={website} onChange={e => setWebsite(e.target.value)}
              placeholder="https://www.yourbusiness.com.au" className="app-field text-[13px]" />
          </div>

          <a href="/directory" target="_blank"
            className="flex items-center gap-1.5 text-[12.5px] text-[var(--blue)] font-semibold hover:opacity-70">
            <Globe size={13} /> Preview your listing
          </a>
        </div>
      )}

      {error && (
        <p className="text-[12.5px] text-[var(--red,#c0392b)] font-semibold mb-3">
          {error}
        </p>
      )}

      <button onClick={save} disabled={saving}
        className="btn-primary w-full justify-center mt-4">
        {saved && !error ? <><Check size={14} /> Saved</> : saving ? "Saving..." : "Save directory settings"}
      </button>
    </div>
  );
}
