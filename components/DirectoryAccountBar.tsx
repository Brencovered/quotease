"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, LogIn, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Signed-in strip for the directory claim and listing editor pages. These
 * use the public MarketingNav, which has no account menu, so a directory
 * login had no way to sign out. When signed out it offers a log in link
 * instead, so an owner who already claimed can get back to their editor.
 */
export default function DirectoryAccountBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  // Nothing renders until the session check finishes, so a signed-in owner
  // never sees a flash of the log in link.
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null)).catch(() => setEmail(null)).finally(() => setChecked(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logOut() {
    setLeaving(true);
    try {
      await createClient().auth.signOut();
    } finally {
      // Full navigation so no signed-in page state survives the sign out
      window.location.href = "/directory";
    }
  }

  if (!checked) return null;
  if (!email) {
    return (
      <div className="border-b border-[#e8ecef] bg-white">
        <div className="max-w-2xl mx-auto px-6 py-2.5 flex items-center justify-between gap-3">
          <span className="text-[13px] text-[#5a6b78] truncate">Already claimed your page?</span>
          <Link href="/directory/manage" className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0a1722] hover:underline">
            <LogIn size={14} />
            Log in
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="border-b border-[#e8ecef] bg-white">
      <div className="max-w-2xl mx-auto px-6 py-2.5 flex items-center justify-between gap-3">
        <span className="text-[13px] text-[#5a6b78] truncate">
          Signed in as <span className="font-semibold text-[#0a1722]">{email}</span>
        </span>
        <button
          onClick={logOut}
          disabled={leaving}
          className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0a1722] hover:underline disabled:opacity-60"
        >
          {leaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          Log out
        </button>
      </div>
    </div>
  );
}
