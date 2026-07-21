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

export type TeamMemberRole = "admin" | "manager" | "site_member";
export type TeamAccessScope = "all" | "assigned_only";

export interface TeamMemberRow {
  id: string;
  email: string;
  name: string | null;
  role: TeamMemberRole;
  access_scope: TeamAccessScope;
  status: string;
  invited_at: string;
  joined_at: string | null;
  hourly_rate: number | null;
}

export interface PendingInviteRow {
  id: string;
  invite_token: string;
  email: string;
  name: string | null;
  role: TeamMemberRole;
  access_scope: TeamAccessScope;
  status: string;
  invited_at: string;
  owner_business_name: string | null;
}

interface TeamPageClientProps {
  members: TeamMemberRow[];
  pendingInvites: PendingInviteRow[];
  /** True for owner and admin - full control over anyone. */
  isAdmin: boolean;
  /** True for owner, admin, and manager - anyone allowed to invite/manage at all (managers are restricted to site_member rows only, enforced by the API). */
  canManageTeam: boolean;
  defaultHourlyRate: number;
  currentUserEmail: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  invited: { bg: "bg-amber-50", text: "text-amber-700", label: "Invited" },
  active: { bg: "bg-green-50", text: "text-green-700", label: "Active" },
};

const ROLE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  owner: { bg: "bg-[var(--amber-light)]", text: "text-[var(--amber-deep)]", label: "Owner" },
  admin: { bg: "bg-blue-50", text: "text-blue-700", label: "Admin" },
  manager: { bg: "bg-purple-50", text: "text-purple-700", label: "Manager" },
  site_member: { bg: "bg-[var(--steel-2)]/10", text: "text-[var(--steel-3)]", label: "Site member" },
};

function roleStyle(role: string) {
  return ROLE_STYLE[role] ?? ROLE_STYLE.site_member;
}

export default function TeamPageClient({
  members: initialMembers,
  pendingInvites: initialPendingInvites,
  isAdmin,
  canManageTeam,
  defaultHourlyRate,
  currentUserEmail,
}: TeamPageClientProps) {
  const router = useRouter();

  const [members, setMembers] = useState(initialMembers);
  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMemberRole>("site_member");
  const [inviteAccessScope, setInviteAccessScope] = useState<TeamAccessScope>("all");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState("");
  const [savingRateId, setSavingRateId] = useState<string | null>(null);

  // A plain manager (not owner/admin) can only ever invite/leave people at
  // the site_member tier - the invite route enforces this too, this just
  // keeps the form from offering an option that'll be silently downgraded.
  const managerCanOnlyInviteSiteMembers = canManageTeam && !isAdmin;

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    setSendMsg("");
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || null,
          role: managerCanOnlyInviteSiteMembers ? "site_member" : inviteRole,
          accessScope: inviteAccessScope,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendMsg(`Invite sent to ${inviteEmail.trim()}`);
        setInviteEmail("");
        setInviteName("");
        setInviteRole("site_member");
        setInviteAccessScope("all");
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
    await fetch("/api/team/" + id, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove" }),
    });
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setRemovingId(null);
  }

  async function updateRole(id: string, newRole: TeamMemberRole, newAccessScope: TeamAccessScope) {
    setUpdatingRoleId(id);
    await fetch("/api/team/" + id, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_role", role: newRole, accessScope: newAccessScope }),
    });
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: newRole, access_scope: newAccessScope } : m)));
    setUpdatingRoleId(null);
  }

  async function cancelInvite(id: string) {
    if (!confirm("Cancel this invite?")) return;
    setRemovingId(id);
    await fetch("/api/team/" + id, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove" }),
    });
    setPendingInvites((prev) => prev.filter((i) => i.id !== id));
    setRemovingId(null);
  }

  async function resendInvite(id: string) {
    setRemovingId(id);
    await fetch("/api/team/" + id, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resend" }),
    });
    setRemovingId(null);
  }

  async function saveRate(memberId: string) {
    const rate = Number(rateDraft);
    if (!rateDraft || isNaN(rate) || rate < 0) { setEditingRateId(null); return; }
    setSavingRateId(memberId);
    const res = await fetch("/api/team/set-rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, rate }),
    });
    setSavingRateId(null);
    setEditingRateId(null);
    if (res.ok) {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, hourly_rate: rate } : m)));
      router.refresh();
    }
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

      {/* Invite form */}
      {canManageTeam && (
        <div className="card">
          <h3 className="font-bold text-[16px] text-[var(--ink)] mb-1 flex items-center gap-2">
            <UserPlus size={16} /> Invite a team member
          </h3>
          <p className="text-[13px] text-[var(--ink-faint)] mb-4">
            {managerCanOnlyInviteSiteMembers
              ? "Add someone as a site member - they'll only see jobs you add them to, and never see pricing."
              : "Send an invite link to add someone to your team, and set what they can see."}
          </p>
          <form onSubmit={sendInvite} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="email" required placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="app-field" />
              <input type="text" placeholder="Name (optional)" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="app-field" />
            </div>
            {!managerCanOnlyInviteSiteMembers && (
              <div className="flex flex-wrap items-center gap-3">
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as TeamMemberRole)} className="app-field text-[13px] w-auto py-2">
                  <option value="site_member">Site member - jobs &amp; dockets only, never sees pricing</option>
                  <option value="manager">Manager - sees pricing, can be limited to specific jobs</option>
                  <option value="admin">Admin - full control, can manage the team</option>
                </select>
                {inviteRole === "manager" && (
                  <select value={inviteAccessScope} onChange={(e) => setInviteAccessScope(e.target.value as TeamAccessScope)} className="app-field text-[13px] w-auto py-2">
                    <option value="all">All jobs</option>
                    <option value="assigned_only">Only jobs they&apos;re added to</option>
                  </select>
                )}
              </div>
            )}
            <button type="submit" disabled={sending} className="btn-primary" style={{ width: "auto", padding: "10px 20px" }}>
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? " Sending..." : " Send invite"}
            </button>
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
            {pendingInvites.map((inv) => {
              const style = roleStyle(inv.role);
              return (
                <div key={inv.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line-subtle)] last:border-0">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--ink)]">{inv.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`pill ${style.bg} ${style.text}`}>{style.label}</span>
                      <span className="text-[11px] text-[var(--ink-faint)]">Sent {new Date(inv.invited_at).toLocaleDateString("en-AU")}</span>
                    </div>
                  </div>
                  {canManageTeam && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => resendInvite(inv.id)} disabled={removingId === inv.id}
                        className="text-[12px] font-semibold text-[var(--navy)] hover:underline disabled:opacity-50">
                        Resend
                      </button>
                      <button onClick={() => cancelInvite(inv.id)} disabled={removingId === inv.id}
                        className="text-[12px] font-bold text-[var(--red)] hover:bg-[var(--red-bg)] rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50">
                        {removingId === inv.id ? "Canceling..." : "Cancel"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active members */}
      <div className="card">
        <h3 className="font-bold text-[16px] text-[var(--ink)] mb-3 flex items-center gap-2">
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
              const style = roleStyle(m.role);
              // A plain manager can only edit site_member rows - matches
              // the API's own enforcement, just avoids offering a control
              // that would get rejected server-side.
              const canEditThisRow = isAdmin || (canManageTeam && m.role === "site_member");
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line-subtle)] last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[var(--app-bg)] border border-[var(--line)] flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-bold text-[var(--ink-soft)]">{(m.name || m.email).charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--ink)] truncate">{m.name || m.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`pill ${style.bg} ${style.text}`}>{style.label}</span>
                        {m.role === "manager" && (
                          <span className="text-[11px] text-[var(--ink-faint)]">{m.access_scope === "assigned_only" ? "Assigned jobs only" : "All jobs"}</span>
                        )}
                        <span className={`pill ${status.bg} ${status.text}`}>{status.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {isAdmin && (
                      editingRateId === m.id ? (
                        <span className="flex items-center gap-1">
                          <span className="text-[12px] text-[var(--ink-faint)]">$</span>
                          <input
                            type="number"
                            autoFocus
                            defaultValue={m.hourly_rate ?? defaultHourlyRate}
                            onChange={(e) => setRateDraft(e.target.value)}
                            onBlur={() => saveRate(m.id)}
                            onKeyDown={(e) => e.key === "Enter" && saveRate(m.id)}
                            className="app-field text-[12px] py-1 w-16"
                          />
                          <span className="text-[11px] text-[var(--ink-faint)]">/hr</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => { setEditingRateId(m.id); setRateDraft(String(m.hourly_rate ?? defaultHourlyRate)); }}
                          disabled={savingRateId === m.id}
                          className="text-[12px] font-semibold text-[var(--ink-soft)] hover:text-[var(--navy)]"
                          title="This person's charge-out rate for job costing - not shown to them"
                        >
                          {savingRateId === m.id ? "Saving..." : `$${m.hourly_rate ?? defaultHourlyRate}/hr${m.hourly_rate == null ? " (default)" : ""}`}
                        </button>
                      )
                    )}
                    {canEditThisRow && (
                      <div className="flex items-center gap-2">
                        {isAdmin ? (
                          <>
                            <select value={m.role} onChange={(e) => updateRole(m.id, e.target.value as TeamMemberRole, m.access_scope)} disabled={updatingRoleId === m.id}
                              className="app-field text-[12px] py-1 w-auto">
                              <option value="site_member">Site member</option>
                              <option value="manager">Manager</option>
                              <option value="admin">Admin</option>
                            </select>
                            {m.role === "manager" && (
                              <select value={m.access_scope} onChange={(e) => updateRole(m.id, m.role, e.target.value as TeamAccessScope)} disabled={updatingRoleId === m.id}
                                className="app-field text-[12px] py-1 w-auto">
                                <option value="all">All jobs</option>
                                <option value="assigned_only">Assigned only</option>
                              </select>
                            )}
                          </>
                        ) : (
                          <span className="pill bg-[var(--steel-2)]/10 text-[var(--steel-3)]">Site member</span>
                        )}
                        <button onClick={() => removeMember(m.id)} disabled={removingId === m.id}
                          className="p-1.5 rounded-lg hover:bg-[var(--red-bg)] transition-colors disabled:opacity-50">
                          <Trash2 size={14} className="text-[var(--ink-faint)]" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
