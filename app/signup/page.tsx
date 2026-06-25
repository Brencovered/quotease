"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!SUPABASE_CONFIGURED) {
      setError(
        "Signup isn't connected yet — this deployment doesn't have a real Supabase project configured."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // business_name travels in user metadata, not a separate insert -
      // a database trigger creates the profile row from this on signup,
      // since there's no logged-in session yet to satisfy RLS directly
      // (Supabase withholds the session until the email is confirmed).
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { business_name: businessName } },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        // Email confirmation is off (or already satisfied) - go straight in.
        router.push("/onboarding");
        router.refresh();
      } else {
        // Confirmation required - no session yet, so there's nowhere
        // authenticated to send them until they click the email link.
        setCheckEmail(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <main className="max-w-sm mx-auto px-6 py-20">
        <h1 className="text-xl font-medium mb-2">Check your email</h1>
        <p className="text-sm text-neutral-600">
          We've sent a confirmation link to <strong>{email}</strong>. Click it, then come back and
          log in.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-20">
      <h1 className="text-xl font-medium mb-1">Create your account</h1>
      <p className="text-sm text-neutral-500 mb-6">You'll pick your trades on the next step.</p>

      {!SUPABASE_CONFIGURED && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
          This deployment isn't connected to a database yet, so signup won't actually work until
          that's set up.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Business name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
          className="w-full border rounded-md px-3 py-2"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded-md px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border rounded-md px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-md py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
    </main>
  );
}
