"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "Something went wrong");
      setLoading(false);
      return;
    }

    // Create the profile row
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      business_name: businessName,
      trade: "electrician",
      contact_email: email,
    });
    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    // Seed the materials library with placeholder defaults — the tradie
    // overwrites these via CSV upload or manual edit on first login.
    const seedRows = ELECTRICIAN_DEFAULT_MATERIALS.map((m) => ({
      profile_id: data.user!.id,
      trade: "electrician",
      item_key: m.item_key,
      label: m.label,
      unit_cost: m.unit_cost,
    }));
    await supabase.from("material_items").insert(seedRows);

    setLoading(false);
    router.push("/billing");
    router.refresh();
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-20">
      <h1 className="text-xl font-medium mb-6">Create your account</h1>
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
