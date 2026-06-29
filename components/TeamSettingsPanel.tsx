"use client";

import { useState } from "react";
import { Mail, Trash2, Shield, Loader2, Send, Check } from "lucide-react";

interface MemberRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  invited_at: string;
  joined_at: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  invited: { bg: "bg-amber-50", text: "text-amber-700", label: "Invited" },
  active:  { bg: "bg-green-50", text: "text-green-700", label: "Active" },
};

export default function TeamSettingsPanel({ members: initialMembers }: { members: MemberRow[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true); setError(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? "Couldn't send that invite."); return; }
      setMembers((prev) => [
        { id: crypto.randomUUID(), email, name: name || null, role, status: "invited", invited_at: new Date().toISOString(), joined_at: null },
        ...prev,
      ]);
      setEmail(""); setName(""); setRole("member");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(id: string) {
    if (!window.confirm("Remove this person from your team? They'll lose access to your jobs and quotes immediately.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });
      if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  async function setMemberRole(id: string, newRole: "admin" | "member") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_role", role: newRole }),
      });
      if (res.ok) setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: newRole } : m)));
    } finally {
      setBusyId(null);
    }
  }

  async function resendInvite(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend" }),
      });
      if (res.ok) { setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={sendInvite} className="card">
        <p className="section-tag mb-3">Invite someone</p>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2.5 mb-2">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="their@email.com" className="app-field"
          />
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)" className="app-field"
          />
          <select value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")} className="app-field w-auto">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <p className="text-[13px] text-[var(--red)] mb-2">{error}</p>}
        <button type="submit" disabled={inviting} className="btn-primary inline-flex">
          {inviting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          {inviting ? "Sending..." : "Send invite"}
        </button>
        <p className="text-[12px] text-[var(--ink-faint)] mt-2">
          They&apos;ll get an email with a link to join. Once accepted, they can see and work on your jobs, quotes, and clients.
        </p>
      </form>

      <div className="card">
        <p className="section-tag mb-3">Your team ({members.length})</p>
        {members.length === 0 ? (
          <p className="text-[13.5px] text-[var(--ink-faint)] py-2">No one invited yet -- it&apos;s just you.</p>
        ) : (
          <ul className="divide-y divide-[var(--line-subtle)]">
            {members.map((m) => {
              const s = STATUS_STYLE[m.status] ?? STATUS_STYLE.invited;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[13.5px] text-[var(--ink)] truncate">{m.name || m.email}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wide ${s.bg} ${s.text}`}>{s.label}</span>
                    </div>
                    <p className="text-[12px] text-[var(--ink-faint)] truncate">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={m.role}
                      onChange={(e) => setMemberRole(m.id, e.target.value as "admin" | "member")}
                      disabled={busyId === m.id}
                      className="app-field py-1 text-[12.5px] w-auto"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    {m.status === "invited" && (
                      <button onClick={() => resendInvite(m.id)} disabled={busyId === m.id} title="Resend invite email" className="p-1.5 text-[var(--ink-faint)] hover:text-[var(--ink)]">
                        {copiedId === m.id ? <Check size={15} /> : <Send size={15} />}
                      </button>
                    )}
                    <button
                      onClick={() => removeMember(m.id)}
                      disabled={busyId === m.id}
                      title="Remove from team"
                      className="p-1.5 text-[var(--ink-faint)] hover:text-[var(--red)]"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="flex items-center gap-1.5 text-[12px] text-[var(--ink-faint)] mt-3">
          <Shield size={13} /> Admins and members can both work on all jobs, quotes, and clients. Only you can manage billing, integrations, and the team list.
        </p>
      </div>
    </div>
  );
}
