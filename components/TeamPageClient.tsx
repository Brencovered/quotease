"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Trash2,
  Shield,
  Loader2,
  Send,
  Users,
  UserPlus,
  UserCheck,
} from "lucide-react";

export interface TeamMemberRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  invited_at: string;
  joined_at: string | null;
}

export interface PendingInviteRow {
  id: string;
  invite_token: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  invited_at: string;
  owner_business_name: string | null;
}

interface TeamPageClientProps {
  members: TeamMemberRow[];
  pendingInvites: PendingInviteRow[];
  isOwner: boolean;
  currentUserEmail: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  invited: { bg: "bg-amber-50", text: "text-amber-700", label: "Invited" },
  active: { bg: "bg-green-50", text: "text-green-700", label: "Active" },
};

const ROLE_STYLE: Record<string, { bg: string; text: string }> = {
  owner: { bg: "bg-[var(--amber-light)]", text: "text-[var(--amber-deep)]" },
  admin: { bg: "bg-blue-50", text: "text-blue-700" },
  member: { bg: "bg-[var(--steel-2)]/10", text: "text-[var(--steel-3)]" },
};

export default function TeamPageClient({
  members: initialMembers,
  pendingInvites: initialPendingInvites,
  isOwner,
  currentUserEmail,
}: TeamPageClientProps) {
  const router = useRouter();

  const [members, setMembers] = useState(initialMembers);
  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    setSendMsg("");
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), name: inviteName.trim() || null, role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendMsg(`Invite sent to ${inviteEmail.trim()}`);
        setInviteEmail("");
        setInviteName("");
        setInviteRole("member");
        router.refresh();
      } else {
        setSendMsg(data.error || "Failed to send invite");
      }
    } catch {
      setSendMsg("Something went wrong");
    }
    setSending(false);
  }

  async function removeMember(id: string) {
    if (!confirm("Remove this team member?")) return;
    setRemovingId(id);
    await fetch("/api/team/" + id, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setRemovingId(null);
  }

  async function updateRole(id: string, newRole: string) {
    setUpdatingRoleId(id);
    await fetch("/api/team/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role: newRole } : m));
    setUpdatingRoleId(null);
  }

  async function cancelInvite(id: string) {
    if (!confirm("Cancel this invite?")) return;
    setRemovingId(id);
    await fetch("/api/team/" + id, { method: "DELETE" });
    setPendingInvites((prev) => prev.filter((i) => i.id !== id));
    setRemovingId(null);
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--amber-light)] flex items-center justify-center shrink-0">
            <Users size={18} className="text-[var(--amber-deep)]" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{members.length}</div>
            <div className="text-[12px] text-[var(--ink-faint)]">Active members</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Mail size={18} className="text-[var(--blue)]" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{pendingInvites.length}</div>
            <div className="text-[12px] text-[var(--ink-faint)]">Pending invites</div>
          </div>
        </div>
        <div className="card flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-lg bg-[var(--green-bg)] flex items-center justify-center shrink-0">
            <Shield size={18} className="text-[var(--green)]" />
          </div>
          <div>
            <div className="text-[14px] font-bold text-[var(--ink)] leading-tight">Owner</div>
            <div className="text-[12px] text-[var(--ink-faint)]">{currentUserEmail || "You"}</div>
          </div>
        </div>
      </div>

      {/* Invite form (owner only) */}
      {isOwner && (
        <div className="card">
          <h3 className="font-bold text-[16px] text-[var(--ink)] mb-1 flex items-center gap-2">
            <UserPlus size={16} /> Invite a team member
          </h3>
          <p className="text-[13px] text-[var(--ink-faint)] mb-4">
            Send an invite link to add someone to your team. They will be able to view and manage jobs and quotes.
          </p>
          <form onSubmit={sendInvite} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="email" required placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="app-field" />
              <input type="text" placeholder="Name (optional)" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="app-field" />
            </div>
            <div className="flex items-center gap-3">
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="app-field text-[13px] w-auto py-2">
                <option value="member">Member - can view and edit</option>
                <option value="admin">Admin - can also manage team</option>
              </select>
              <button type="submit" disabled={sending} className="btn-primary" style={{ width: "auto", padding: "10px 20px" }}>
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {sending ? " Sending..." : " Send invite"}
              </button>
            </div>
            {sendMsg && (
              <p className={`text-[13px] font-semibold ${sendMsg.includes("sent") ? "text-[var(--green)]" : "text-[var(--red)]"}`}>{sendMsg}</p>
            )}
          </form>
        </div>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-[16px] text-[var(--ink)] mb-3 flex items-center gap-2">
            <Mail size={16} className="text-amber-600" /> Pending invites
          </h3>
          <div className="space-y-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line-subtle)] last:border-0">
                <div>
                  <p className="text-[14px] font-semibold text-[var(ink)]">{inv.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`pill ${ROLE_STYLE[inv.role]?.bg ?? ROLE_STYLE.member.bg} ${ROLE_STYLE[inv.role]?.text ?? ROLE_STYLE.member.text}`}>{inv.role}</span>
                    <span className="text-[11px] text-[var(--ink-faint)]">Sent {new Date(inv.invited_at).toLocaleDateString("en-AU")}</span>
                  </div>
                </div>
                {isOwner && (
                  <button onClick={() => cancelInvite(inv.id)} disabled={removingId === inv.id}
                    className="text-[12px] font-bold text-[var(--red)] hover:bg-[var(--red-bg)] rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50">
                    {removingId === inv.id ? "Canceling..." : "Cancel"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active members */}
      <div className="card">
        <h3 className="font-bold text-[16px] text-[var(ink)] mb-3 flex items-center gap-2">
          <UserCheck size={16} /> Team members
        </h3>
        {members.length === 0 ? (
          <div className="text-center py-8">
            <Users size={28} className="mx-auto mb-3 text-[var(--ink-faint)]" />
            <p className="font-semibold text-[var(--ink)] mb-1">Build your crew</p>
            <p className="text-[13px] text-[var(--ink-faint)] max-w-sm mx-auto">
              Invite team members to collaborate on jobs, share quotes, and keep everyone in sync.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const status = STATUS_STYLE[m.status] ?? STATUS_STYLE.active;
              const role = ROLE_STYLE[m.role] ?? ROLE_STYLE.member;
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line-subtle)] last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[var(--app-bg)] border border-[var(--line)] flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-bold text-[var(--ink-soft)]">{(m.name || m.email).charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[var(ink)] truncate">{m.name || m.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`pill ${role.bg} ${role.text}`}>{m.role}</span>
                        <span className={`pill ${status.bg} ${status.text}`}>{status.label}</span>
                      </div>
                    </div>
                  </div>
                  {isOwner && m.role !== "owner" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <select value={m.role} onChange={(e) => updateRole(m.id, e.target.value)} disabled={updatingRoleId === m.id}
                        className="app-field text-[12px] py-1 w-auto">
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button onClick={() => removeMember(m.id)} disabled={removingId === m.id}
                        className="p-1.5 rounded-lg hover:bg-[var(--red-bg)] transition-colors disabled:opacity-50">
                        <Trash2 size={14} className="text-[var(--ink-faint)]" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
