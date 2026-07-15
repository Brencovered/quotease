"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function TeamAcceptPanel({
  token,
  invitedEmail,
  businessName,
  status,
  currentUserEmail,
}: {
  token: string;
  invitedEmail: string;
  businessName: string;
  status: string;
  currentUserEmail: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = `/team/accept/${token}`;
  const emailMatches = currentUserEmail?.toLowerCase() === invitedEmail.toLowerCase();

  async function accept() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? "Couldn't accept this invite."); return; }
      router.push("/dashboard");
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
        <h1 className="font-display text-[22px] text-[var(--ink)] mb-2">Join {businessName}</h1>

        {status === "removed" ? (
          <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6]">This invite has been revoked. Ask {businessName} to send a new one.</p>
        ) : status === "active" ? (
          <>
            <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6] mb-5">You&apos;re already on this team.</p>
            <Link href="/dashboard" className="btn-primary inline-flex justify-center">Go to dashboard →</Link>
          </>
        ) : !currentUserEmail ? (
          <>
            <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6] mb-5">
              You&apos;ve been invited as a team member, working on {businessName}&apos;s jobs and quotes.
              Log in or create an account with <strong className="text-[var(--ink)]">{invitedEmail}</strong> to accept.
            </p>
            <div className="flex flex-col gap-2">
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-primary inline-flex justify-center">Log in</Link>
              <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-[13.5px] font-bold text-[var(--navy)] hover:underline py-2">
                Don&apos;t have an account? Sign up
              </Link>
            </div>
          </>
        ) : !emailMatches ? (
          <>
            <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6] mb-5">
              This invite was sent to <strong className="text-[var(--ink)]">{invitedEmail}</strong>, but you&apos;re logged in as{" "}
              <strong className="text-[var(--ink)]">{currentUserEmail}</strong>. Log out and log back in with the invited email to accept.
            </p>
          </>
        ) : (
          <>
            <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6] mb-5">
              Accept to start working on {businessName}&apos;s jobs, quotes, and clients.
            </p>
            <button onClick={accept} disabled={loading} className="btn-primary w-full">
              {loading ? "Joining..." : "Accept invite"}
            </button>
            {error && <p className="text-[13px] text-[var(--red)] mt-3">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}
