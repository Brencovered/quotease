"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Bell,
  AlertTriangle,
  Send,
  Mail,
  Palette,
  FileText,
  CheckCircle2,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Download,
  Sparkles,
  Save,
  Loader2,
} from "lucide-react";

type Quote = {
  id: string;
  client_name: string | null;
  client_email: string | null;
  site_address: string | null;
  status: string;
  total_cost: number | null;
  amount_paid: number | null;
  completed_at: string | null;
  quote_expires_at: string | null;
  sent_at: string | null;
  public_token: string | null;
  created_at: string;
};

type Job = {
  id: string;
  client_name: string | null;
  client_email: string | null;
  site_address: string | null;
  total_cost: number | null;
  amount_paid: number | null;
  completed_at: string | null;
};

type Template = {
  id: string;
  profile_id: string;
  type: string;
  subject: string;
  body: string;
  is_default: boolean;
};

const TAB_LABELS = [
  { key: "reminders", icon: Bell, label: "Send Reminders" },
  { key: "templates", icon: Mail, label: "Email Templates" },
  { key: "branding", icon: Palette, label: "Quote Branding" },
  { key: "brochures", icon: FileText, label: "Brochures" },
];

const TYPE_COLORS: Record<string, string> = {
  overdue_invoice: "bg-[var(--red-bg)] text-[var(--red)]",
  expiring_quote: "bg-amber-50 text-amber-700",
  quote_follow_up: "bg-[var(--blue-bg)] text-[var(--blue)]",
  job_update: "bg-[var(--green-bg)] text-[var(--green)]",
  custom: "bg-gray-100 text-gray-600",
};

export default function CommsPanel({
  initialTemplates,
  branding: initialBranding,
  outstandingJobs,
  expiringQuotes,
}: {
  initialTemplates: Template[];
  branding: Record<string, string | null>;
  outstandingJobs: Job[];
  expiringQuotes: Quote[];
  businessId: string;
}) {
  const [tab, setTab] = useState("reminders");
  const [templates, setTemplates] = useState(initialTemplates);
  const [branding, setBranding] = useState(initialBranding);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (toast) setTimeout(() => setToast(""), 3000);
  }, [toast]);

  const overdueJobs = outstandingJobs.filter((j) => j.completed_at && (j.amount_paid ?? 0) < (j.total_cost ?? 0));

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto hide-scrollbar pb-1">
        {TAB_LABELS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-bold whitespace-nowrap border-2 transition-colors ${
                tab === t.key ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)] bg-[var(--surface)]"
              }`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-[var(--navy)] text-white px-4 py-3 rounded-xl shadow-lg text-[13px] font-bold flex items-center gap-2">
          <CheckCircle2 size={15} /> {toast}
        </div>
      )}

      {tab === "reminders" && (
        <RemindersTab
          overdueJobs={overdueJobs}
          expiringQuotes={expiringQuotes}
          templates={templates}
          branding={branding}
          onToast={setToast}
        />
      )}
      {tab === "templates" && (
        <TemplatesTab
          templates={templates}
          onUpdate={setTemplates}
          onToast={setToast}
        />
      )}
      {tab === "branding" && (
        <BrandingTab
          branding={branding}
          onUpdate={setBranding}
          onToast={setToast}
        />
      )}
      {tab === "brochures" && (
        <BrochuresTab branding={branding} />
      )}
    </div>
  );
}

/* ─────────────────────────── Reminders Tab ─────────────────────────── */

function RemindersTab({
  overdueJobs,
  expiringQuotes,
  templates,
  branding,
  onToast,
}: {
  overdueJobs: Job[];
  expiringQuotes: Quote[];
  templates: Template[];
  branding: Record<string, string | null>;
  onToast: (msg: string) => void;
}) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingType, setSendingType] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ type: string; quoteId: string; subject: string; body: string } | null>(null);

  async function sendReminder(quoteId: string, type: string) {
    setSendingId(quoteId);
    setSendingType(type);
    const template = templates.find((t) => t.type === type && t.is_default);
    try {
      const res = await fetch("/api/comms/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, type, templateId: template?.id }),
      });
      if (res.ok) onToast(type === "overdue_invoice" ? "Invoice reminder sent" : "Quote reminder sent");
      else onToast("Failed to send");
    } catch {
      onToast("Failed to send");
    }
    setSendingId(null);
    setSendingType(null);
  }

  async function previewReminder(quoteId: string, type: string) {
    const template = templates.find((t) => t.type === type && t.is_default);
    const quote = type === "overdue_invoice"
      ? overdueJobs.find((j) => j.id === quoteId)
      : expiringQuotes.find((q) => q.id === quoteId);
    if (!quote) return;
    const business = branding?.business_name ?? "Your tradie";
    const owing = Math.max((quote.total_cost ?? 0) - (quote.amount_paid ?? 0), 0);
    const subject = template?.subject ?? (type === "overdue_invoice" ? `Payment reminder for ${business} invoice` : `Your quote from ${business}`);
    let body = template?.body ?? "";
    if (!body) {
      body = type === "overdue_invoice"
        ? `Hi {{client_name}},\n\nThis is a friendly reminder that payment of $${owing} is outstanding for work completed at {{site_address}}.\n\nPlease contact us to arrange payment.\n\nThanks,\n{{business_name}}`
        : `Hi {{client_name}},\n\nJust a reminder that your quote of $${quote.total_cost} for work at {{site_address}} will expire soon.\n\nTo accept, visit: {{quote_url}}\n\nThanks,\n{{business_name}}`;
    }
    const vars: Record<string, string> = {
      client_name: quote.client_name ?? "there",
      amount: owing > 0 ? owing.toLocaleString() : (quote.total_cost ?? 0).toLocaleString(),
      business_name: business,
      site_address: quote.site_address ?? "your property",
      quote_url: ``,
    };
    const finalSubject = subject.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
    const finalBody = body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
    setPreview({ type, quoteId, subject: finalSubject, body: finalBody });
  }

  return (
    <div className="space-y-6">
      {/* Overdue invoices */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[16px] text-[var(--ink)] flex items-center gap-2">
            <AlertTriangle size={16} className="text-[var(--red)]" /> Overdue invoices ({overdueJobs.length})
          </h3>
          {overdueJobs.length > 0 && (
            <button onClick={async () => { for (const j of overdueJobs) { await sendReminder(j.id, "overdue_invoice"); } onToast("All reminders sent"); }}
              className="text-[12px] font-bold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-1.5 hover:border-[var(--amber)] transition-colors">
              Send all
            </button>
          )}
        </div>
        {overdueJobs.length === 0 ? (
          <div className="card text-center py-8">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-[var(--green)]" />
            <p className="text-[13px] text-[var(--ink-faint)]">No overdue invoices. Great job!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {overdueJobs.map((j) => {
              const owing = (j.total_cost ?? 0) - (j.amount_paid ?? 0);
              const isSending = sendingId === j.id && sendingType === "overdue_invoice";
              return (
                <div key={j.id} className="card flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[14px] text-[var(--ink)] truncate">{j.client_name || "Unnamed"}</p>
                    <p className="text-[12px] text-[var(--ink-faint)]">{j.site_address}</p>
                    <p className="text-[13px] font-bold text-[var(--red)] mt-0.5">${owing.toLocaleString()} owing</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => previewReminder(j.id, "overdue_invoice")} className="btn-secondary text-[11px] py-1.5 px-2.5">
                      <Eye size={12} /> Preview
                    </button>
                    <button onClick={() => sendReminder(j.id, "overdue_invoice")} disabled={isSending}
                      className="text-[11px] font-bold bg-[var(--red)] text-white rounded-lg px-3 py-1.5 hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1">
                      <Send size={11} /> {isSending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expiring quotes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[16px] text-[var(--ink)] flex items-center gap-2">
            <Bell size={16} className="text-amber-600" /> Expiring quotes ({expiringQuotes.length})
          </h3>
          {expiringQuotes.length > 0 && (
            <button onClick={async () => { for (const q of expiringQuotes) { await sendReminder(q.id, "expiring_quote"); } onToast("All reminders sent"); }}
              className="text-[12px] font-bold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-1.5 hover:border-[var(--amber)] transition-colors">
              Send all
            </button>
          )}
        </div>
        {expiringQuotes.length === 0 ? (
          <div className="card text-center py-8">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-[var(--green)]" />
            <p className="text-[13px] text-[var(--ink-faint)]">No quotes expiring soon.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expiringQuotes.map((q) => {
              const isSending = sendingId === q.id && sendingType === "expiring_quote";
              const daysLeft = q.quote_expires_at ? Math.ceil((new Date(q.quote_expires_at).getTime() - Date.now()) / 86400000) : 0;
              return (
                <div key={q.id} className="card flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[14px] text-[var(--ink)] truncate">{q.client_name || "Unnamed"}</p>
                    <p className="text-[12px] text-[var(--ink-faint)]">{q.site_address}</p>
                    <p className={`text-[12px] font-bold mt-0.5 ${daysLeft <= 0 ? "text-[var(--red)]" : "text-amber-600"}`}>
                      {daysLeft <= 0 ? "Expired" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`} - ${(q.total_cost ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => previewReminder(q.id, "expiring_quote")} className="btn-secondary text-[11px] py-1.5 px-2.5">
                      <Eye size={12} /> Preview
                    </button>
                    <button onClick={() => sendReminder(q.id, "expiring_quote")} disabled={isSending}
                      className="text-[11px] font-bold bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 transition-colors disabled:opacity-50 inline-flex items-center gap-1">
                      <Send size={11} /> {isSending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-[var(--ink)] mb-1">{preview.type === "overdue_invoice" ? "Invoice Reminder" : "Quote Reminder"}</p>
            <p className="text-[12px] text-[var(--ink-faint)] mb-3">Subject: {preview.subject}</p>
            <div className="bg-[var(--app-bg)] rounded-xl p-4 text-[13px] text-[var(--ink-soft)] whitespace-pre-line mb-4 border border-[var(--line)]">
              {preview.body}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { sendReminder(preview.quoteId, preview.type); setPreview(null); }} className="btn-primary flex-1">
                <Send size={13} /> Send now
              </button>
              <button onClick={() => setPreview(null)} className="btn-secondary flex-1 justify-center">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Templates Tab ─────────────────────────── */

function TemplatesTab({
  templates,
  onUpdate,
  onToast,
}: {
  templates: Template[];
  onUpdate: (t: Template[]) => void;
  onToast: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ type: "custom", subject: "", body: "" });
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function saveTemplate() {
    setSaving(true);
    const res = await fetch("/api/comms/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, type: form.type, subject: form.subject, body: form.body } : { type: form.type, subject: form.subject, body: form.body }),
    });
    if (res.ok) {
      const { data: { user } } = await supabase.auth.getUser();
      const profileId = user?.id;
      if (profileId) {
        const { data } = await supabase.from("communication_templates").select("*").eq("profile_id", profileId).order("created_at", { ascending: false });
        onUpdate(data ?? []);
      }
      setEditing(null);
      setForm({ type: "custom", subject: "", body: "" });
      onToast(editing ? "Template updated" : "Template created");
    } else {
      onToast("Failed to save");
    }
    setSaving(false);
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    const res = await fetch("/api/comms/templates?id=" + id, { method: "DELETE" });
    if (res.ok) {
      onUpdate(templates.filter((t) => t.id !== id));
      onToast("Template deleted");
    }
  }

  function openEdit(t: Template) {
    setEditing(t);
    setForm({ type: t.type, subject: t.subject, body: t.body });
  }

  function openCreate() {
    setEditing(null);
    setForm({ type: "custom", subject: "", body: "" });
  }

  const grouped = templates.reduce((acc, t) => {
    acc[t.type] = [...(acc[t.type] ?? []), t];
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[16px] text-[var(--ink)]">Email Templates</h3>
        <button onClick={openCreate} className="btn-primary text-[12px] py-2" style={{ width: "auto", padding: "8px 16px" }}>
          <Plus size={13} /> New template
        </button>
      </div>

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <p className="section-tag mb-2 capitalize">{type.replace(/_/g, " ")}</p>
          <div className="space-y-2">
            {items.map((t) => (
              <div key={t.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[14px] text-[var(--ink)] truncate">{t.subject}</p>
                  <p className="text-[12px] text-[var(--ink-faint)] line-clamp-2 mt-0.5">{t.body}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`pill ${TYPE_COLORS[t.type] ?? TYPE_COLORS.custom}`}>{t.type}</span>
                    {t.is_default && <span className="pill bg-[var(--amber-light)] text-[var(--amber-deep)]">Default</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)]"><Edit3 size={14} className="text-[var(--ink-faint)]" /></button>
                  {!t.is_default && (
                    <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded-lg hover:bg-[var(--red-bg)]"><Trash2 size={14} className="text-[var(--ink-faint)]" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {templates.length === 0 && (
        <div className="card text-center py-10">
          <Mail size={24} className="mx-auto mb-2 text-[var(--ink-faint)]" />
          <p className="text-[13px] text-[var(--ink-faint)]">No templates yet. Create your first one!</p>
        </div>
      )}

      {/* Edit/Create modal */}
      {(editing || form.subject !== "" || form.body !== "") && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-lg shadow-2xl">
            <p className="font-bold text-[var(--ink)] mb-4">{editing ? "Edit Template" : "New Template"}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Type</label>
                <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))} className="app-field text-[13px]">
                  <option value="custom">Custom</option>
                  <option value="overdue_invoice">Overdue Invoice</option>
                  <option value="expiring_quote">Expiring Quote</option>
                  <option value="quote_follow_up">Quote Follow-up</option>
                  <option value="job_update">Job Update</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Subject</label>
                <input type="text" value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))} className="app-field" placeholder="Email subject line" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Body</label>
                <textarea value={form.body} onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))} className="app-field" rows={6} placeholder="Email body text. Use {{client_name}}, {{amount}}, {{quote_url}}, {{business_name}}, {{site_address}} as variables." />
                <p className="text-[11px] text-[var(--ink-faint)] mt-1">
                  Variables: {"{{client_name}}, {{amount}}, {{quote_url}}, {{business_name}}, {{site_address}}"}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveTemplate} disabled={saving || !form.subject.trim() || !form.body.trim()} className="btn-primary flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? " Saving..." : " Save"}
              </button>
              <button onClick={() => { setEditing(null); setForm({ type: "custom", subject: "", body: "" }); }} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Branding Tab ─────────────────────────── */

function BrandingTab({
  branding: initialBranding,
  onUpdate,
  onToast,
}: {
  branding: Record<string, string | null>;
  onUpdate: (b: Record<string, string | null>) => void;
  onToast: (msg: string) => void;
}) {
  const [primaryColor, setPrimaryColor] = useState(initialBranding?.branding_primary_color ?? "#ffb400");
  const [tagline, setTagline] = useState(initialBranding?.branding_tagline ?? "");
  const [footer, setFooter] = useState(initialBranding?.branding_email_footer ?? "Sent via Swiftscope");
  const [saving, setSaving] = useState(false);

  async function saveBranding() {
    setSaving(true);
    const res = await fetch("/api/comms/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryColor, tagline, emailFooter: footer }),
    });
    if (res.ok) {
      onUpdate({ ...initialBranding, branding_primary_color: primaryColor, branding_tagline: tagline, branding_email_footer: footer });
      onToast("Branding saved");
    } else {
      onToast("Failed to save");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="card space-y-4">
          <h3 className="font-bold text-[16px] text-[var(--ink)] flex items-center gap-2">
            <Palette size={16} /> Quote Branding
          </h3>

          <div>
            <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Primary color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded-lg border border-[var(--line)] cursor-pointer" />
              <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="app-field text-[13px] w-28" />
              <div className="flex gap-1">
                {["#ffb400", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#f97316"].map((c) => (
                  <button key={c} onClick={() => setPrimaryColor(c)} className="w-6 h-6 rounded-full border border-[var(--line)]" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Business tagline</label>
            <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} className="app-field" placeholder="e.g. Quality electrical work guaranteed" />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Email footer</label>
            <input type="text" value={footer} onChange={(e) => setFooter(e.target.value)} className="app-field" placeholder="Sent via Swiftscope" />
          </div>

          <button onClick={saveBranding} disabled={saving} className="btn-primary" style={{ width: "auto", padding: "10px 20px" }}>
            {saving ? "Saving..." : "Save branding"}
          </button>
        </div>

        {/* Preview */}
        <div>
          <p className="section-tag mb-2">Preview</p>
          <div className="border border-[var(--line)] rounded-xl overflow-hidden">
            <div className="p-4" style={{ backgroundColor: "#0a1722" }}>
              <p className="font-display text-[16px] font-bold text-white tracking-widest">{(initialBranding?.business_name ?? "YOUR BUSINESS").toUpperCase()}</p>
              {tagline && <p className="text-[11px] text-[var(--steel-3)] mt-0.5">{tagline}</p>}
            </div>
            <div className="p-3" style={{ backgroundColor: primaryColor }}>
              <p className="text-[12px] font-black text-[#0a1722] tracking-wide">QUOTE</p>
            </div>
            <div className="bg-white p-4">
              <p className="text-[13px] text-[#334155] mb-2">Hi Client,</p>
              <p className="text-[12px] text-[#64748b] mb-3">Here is your quote for the work at your property.</p>
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: primaryColor }}>
                <p className="text-[13px] font-black text-[#0a1722]">View quote &amp; pay</p>
              </div>
            </div>
            <div className="bg-[#f8fafc] p-3 border-t border-[#e2e8f0]">
              <p className="text-[10px] text-[#94a3b8] text-center">{footer}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Brochures Tab ─────────────────────────── */

function BrochuresTab({ branding }: { branding: Record<string, string | null> }) {
  const [template, setTemplate] = useState("services");
  const [generating, setGenerating] = useState(false);
  const [brochureHtml, setBrochureHtml] = useState("");

  async function generateBrochure() {
    setGenerating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setGenerating(false); return; }
    const [{ data: profile }, { data: materials }] = await Promise.all([
      supabase.from("profiles").select("business_name, contact_email, contact_phone, logo_url, branding_tagline").eq("id", user.id).single(),
      supabase.from("material_items").select("label, unit_cost, trade").eq("profile_id", user.id).order("label").limit(50),
    ]);

    const business = profile?.business_name ?? "Your Business";
    const tagline = profile?.branding_tagline ?? "Quality trade services";

    let html = "";
    if (template === "services") {
      const byTrade = (materials ?? []).reduce((acc: Record<string, typeof materials>, m) => {
        acc[m.trade] = [...(acc[m.trade] ?? []), m];
        return acc;
      }, {});
      html = `<div style="max-width:700px;margin:0 auto;font-family:Arial,sans-serif;padding:40px;">
        <div style="background:#0a1722;padding:32px;border-radius:16px 16px 0 0;text-align:center;">
          <h1 style="color:#fff;font-size:28px;font-weight:900;letter-spacing:2px;margin:0;">${business}</h1>
          <p style="color:#a9bcc8;font-size:14px;margin:8px 0 0;">${tagline}</p>
        </div>
        <div style="background:#ffb400;padding:16px 32px;text-align:center;">
          <p style="color:#0a1722;font-size:16px;font-weight:800;margin:0;letter-spacing:1px;">OUR SERVICES</p>
        </div>
        <div style="background:#fff;padding:32px;">
          ${Object.entries(byTrade).map(([trade, items]) => `
            <h2 style="color:#0a1722;font-size:18px;font-weight:700;text-transform:capitalize;margin:24px 0 12px;border-bottom:2px solid #ffb400;padding-bottom:8px;">${trade}</h2>
            <table width="100%" style="border-collapse:collapse;">
              ${(items ?? []).slice(0, 15).map((m: { label: string; unit_cost: number }) => `
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:10px 0;font-size:14px;color:#334155;">${m.label}</td>
                  <td style="padding:10px 0;font-size:14px;color:#0a1722;font-weight:700;text-align:right;">$${m.unit_cost}</td>
                </tr>
              `).join("")}
            </table>
          `).join("")}
        </div>
        <div style="background:#f8fafc;padding:24px 32px;border-radius:0 0 16px 16px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="color:#64748b;font-size:14px;margin:0;">Contact us: ${profile?.contact_phone ?? ""} | ${profile?.contact_email ?? ""}</p>
        </div>
      </div>`;
    } else {
      html = `<div style="max-width:700px;margin:0 auto;font-family:Arial,sans-serif;padding:40px;">
        <div style="background:#0a1722;padding:32px;border-radius:16px 16px 0 0;text-align:center;">
          <h1 style="color:#fff;font-size:28px;font-weight:900;letter-spacing:2px;margin:0;">${business}</h1>
          <p style="color:#a9bcc8;font-size:14px;margin:8px 0 0;">${tagline}</p>
        </div>
        <div style="background:#ffb400;padding:16px 32px;text-align:center;">
          <p style="color:#0a1722;font-size:16px;font-weight:800;margin:0;letter-spacing:1px;">ABOUT US</p>
        </div>
        <div style="background:#fff;padding:32px;">
          <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 16px;">We provide professional trade services with a commitment to quality, reliability, and customer satisfaction. Contact us today for a free quote.</p>
          <div style="background:#f8fafc;border-radius:12px;padding:24px;margin-top:24px;">
            <h3 style="color:#0a1722;font-size:16px;font-weight:700;margin:0 0 12px;">Why choose us?</h3>
            <ul style="color:#64748b;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
              <li>Licensed and insured professionals</li>
              <li>Upfront, transparent pricing</li>
              <li>Quality workmanship guaranteed</li>
              <li>On-time, every time</li>
            </ul>
          </div>
        </div>
        <div style="background:#f8fafc;padding:24px 32px;border-radius:0 0 16px 16px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="color:#64748b;font-size:14px;margin:0;">Contact us: ${profile?.contact_phone ?? ""} | ${profile?.contact_email ?? ""}</p>
        </div>
      </div>`;
    }

    setBrochureHtml(html);
    setGenerating(false);
  }

  function downloadPdf() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Brochure</title></head><body>${brochureHtml}<script>window.print();</script></body></html>`);
    printWindow.document.close();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <h3 className="font-bold text-[16px] text-[var(--ink)] flex items-center gap-2">
          <FileText size={16} /> Generate Brochure
        </h3>
        <div>
          <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Template</label>
          <div className="flex gap-2">
            {[
              { key: "services", label: "Services list" },
              { key: "about", label: "About us" },
            ].map((t) => (
              <button key={t.key} onClick={() => setTemplate(t.key)}
                className={`px-4 py-2 rounded-xl text-[12.5px] font-bold border-2 transition-colors ${
                  template === t.key ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={generateBrochure} disabled={generating} className="btn-primary" style={{ width: "auto", padding: "10px 20px" }}>
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generating ? " Generating..." : " Generate brochure"}
        </button>
      </div>

      {brochureHtml && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="section-tag">Preview</p>
            <button onClick={downloadPdf} className="text-[12px] font-bold text-[var(--navy)] flex items-center gap-1 border-2 border-[var(--line)] rounded-lg px-3 py-1.5 hover:border-[var(--amber)] transition-colors">
              <Download size={13} /> Download PDF
            </button>
          </div>
          <div className="border border-[var(--line)] rounded-xl overflow-hidden bg-white">
            <iframe srcDoc={brochureHtml} className="w-full h-[600px]" title="Brochure preview" />
          </div>
        </div>
      )}
    </div>
  );
}
