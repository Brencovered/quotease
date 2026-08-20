"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function TeamAcceptPanel({
  token,
  invitedEmail,
  invitedName,
  businessName,
  status,
  currentUserEmail,
  alreadyHadAccount,
}: {
  token: string;
  invitedEmail: string;
  invitedName: string | null;
  businessName: string;
  status: string;
  currentUserEmail: string | null;
  /** True when this email already signed into Swiftscope before (show sign-in option more prominently). */
  alreadyHadAccount: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = `/team/accept/${token}`;
  const emailMatches =
    currentUserEmail?.toLowerCase() === invitedEmail.toLowerCase();

  async function acceptWhileLoggedIn() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't accept this invite.");
        return;
      }
      router.push("/today");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function setPasswordAndJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/team/complete-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't join the team.");
        return;
      }

      const supabase = createClient();
      // Clear any other session so we land as the invitee.
      await supabase.auth.signOut();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitedEmail,
        password,
      });
      if (signInError) {
        setError(
          signInError.message ||
            "Password set, but sign-in failed. Try logging in with your new password."
        );
        return;
      }

      router.push("/today");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] flex items-center justify-center px-4">
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-[var(--amber-light)] border border-[var(--amber)]/30 flex items-center justify-center mx-auto mb-4 text-2xl">
          🤝
        </div>
        <h1 className="font-display text-[22px] text-[var(--ink)] mb-2">
          Join {businessName}
        </h1>

        {status === "removed" ? (
          <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6]">
            This invite has been revoked. Ask {businessName} to send a new one.
          </p>
        ) : status === "active" ? (
          <>
            <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6] mb-5">
              You&apos;re already on this team.
            </p>
            <Link
              href="/today"
              className="btn-primary inline-flex justify-center"
            >
              Go to My day →
            </Link>
          </>
        ) : currentUserEmail && !emailMatches ? (
          <>
            <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6] mb-5">
              This invite was sent to{" "}
              <strong className="text-[var(--ink)]">{invitedEmail}</strong>, but
              you&apos;re logged in as{" "}
              <strong className="text-[var(--ink)]">{currentUserEmail}</strong>.
              Log out and open this link again to join as the invited person.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="btn-primary inline-flex justify-center"
            >
              Switch account
            </Link>
          </>
        ) : currentUserEmail && emailMatches ? (
          <>
            <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6] mb-5">
              Accept to start working on {businessName}&apos;s jobs, quotes, and
              clients.
            </p>
            <button
              onClick={acceptWhileLoggedIn}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Joining..." : "Accept invite"}
            </button>
            {error && (
              <p className="text-[13px] text-[var(--red)] mt-3">{error}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6] mb-5">
              {invitedName ? `Hi ${invitedName} — ` : ""}
              you&apos;ve been added to <strong className="text-[var(--ink)]">{businessName}</strong>
              . Set a password for{" "}
              <strong className="text-[var(--ink)]">{invitedEmail}</strong> to
              join their company.
            </p>

            <form onSubmit={setPasswordAndJoin} className="text-left space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={invitedEmail}
                  readOnly
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--app-bg)] px-3 py-2.5 text-[14px] text-[var(--ink)] opacity-80"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-[14px] text-[var(--ink)]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1">
                  Confirm password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-[14px] text-[var(--ink)]"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
                {loading ? "Joining..." : "Set password & join"}
              </button>
            </form>

            {error && (
              <p className="text-[13px] text-[var(--red)] mt-3">{error}</p>
            )}

            <p className="text-[13px] text-[var(--ink-soft)] mt-4 leading-[1.5]">
              {alreadyHadAccount
                ? "Already have a Swiftscope password?"
                : "Already set a password before?"}{" "}
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                className="font-bold text-[var(--navy)] hover:underline"
              >
                Sign in instead
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
