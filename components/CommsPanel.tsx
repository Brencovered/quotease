"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bell,
  AlertTriangle,
  Send,
  Mail,
  Palette,
  FileText,
  CheckCircle2,
  X,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Download,
  Sparkles,
  Save,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
  status: string;
};

 type Template = {
  id: string;
  profile_id: string;
  type: string;
  subject: string;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

 type Branding = {
  business_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  branding_primary_color: string | null;
  branding_tagline: string | null;
  branding_email_footer: string | null;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

 const TABS = [
  { key: "reminders", label: "Send Reminders", icon: Bell },
  { key: "templates", label: "Email Templates", icon: Mail },
  { key: "branding", label: "Quote Branding", icon: Palette },
  { key: "brochures", label: "Brochures", icon: FileText },
];

 const TEMPLATE_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  overdue_invoice: { label: "Overdue Invoice", color: "text-[var(--red)]", bg: "bg-[var(--red-bg)]" },
  expiring_quote:  { label: "Expiring Quote",  color: "text-amber-600",      bg: "bg-amber-50" },
  quote_follow_up: { label: "Quote Follow-up", color: "text-[var(--blue)]",   bg: "bg-[var(--blue-bg)]" },
  job_update:      { label: "Job Update",      color: "text-[var(--green)]",  bg: "bg-[var(--green-bg)]" },
  custom:          { label: "Custom",          color: "text-[var(--ink-soft)]", bg: "bg-[var(--app-bg)]" },
};

 const VAR_HELPERS = [
  { key: "{{client_name}}", desc: "Client name" },
  { key: "{{amount}}",      desc: "Amount owing" },
  { key: "{{quote_url}}",   desc: "Quote link" },
  { key: "{{business_name}}", desc: "Your business" },
  { key: "{{site_address}}",  desc: "Job address" },
];

 function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

 function daysAgo(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

 export default function CommsPanel({
  jobsWithOutstanding,
  expiringQuotes,
  templates: initialTemplates,
  branding: initialBranding,
  completedJobs,
}: {
  jobsWithOutstanding: Job[];
  expiringQuotes: Quote[];
  templates: Template[];
  branding: Branding | null;
  completedJobs: Job[];
}) {
  const [activeTab, setActiveTab] = useState("reminders");
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [branding, setBranding] = useState<Branding | null>(initialBranding);
  const [toast, setToast] = useState<string | null>(null);

  // Seed templates on first load if empty
  useEffect(() => {
    if (templates.length === 0) {
      fetch("/api/comms/seed", { method: "POST" })
        .then((r) => r.json())
        .then((data) => {
          if (data.seeded) {
            fetch("/api/comms/templates")
              .then((r) => r.json())
              .then((d) => { if (d.templates) setTemplates(d.templates); });
          }
        });
    }
    // Refresh branding from API in case it changed
    fetch("/api/comms/branding")
      .then((r) => r.json())
      .then((d) => { if (d.branding) setBranding(d.branding); });
  }, [templates.length]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-[28px] text-[var(--ink)]">Communications</h1>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--navy)] text-white text-[13px] font-semibold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <CheckCircle2 size={15} />
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto hide-scrollbar pb-1">
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-bold whitespace-nowrap border-2 transition-colors ${
                active
                  ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                  : "border-[var(--line)] text-[var(--ink-faint)] bg-[var(--surface)]"
              }`}
            >
              <t.icon size={14} strokeWidth={active ? 2.5 : 1.8} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "reminders" && (
        <RemindersTab
          jobs={jobsWithOutstanding}
          quotes={expiringQuotes}
          templates={templates}
          branding={branding}
          onToast={showToast}
        />
      )}
      {activeTab === "templates" && (
        <TemplatesTab
          templates={templates}
          onUpdate={setTemplates}
          onToast={showToast}
        />
      )}
      {activeTab === "branding" && (
        <BrandingTab
          branding={branding}
          onUpdate={setBranding}
          onToast={showToast}
        />
      )}
      {activeTab === "brochures" && (
        <BrochuresTab
          completedJobs={completedJobs}
          branding={branding}
          quotes={expiringQuotes}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  TAB 1: Send Reminders                                             */
/* ================================================================== */

 function RemindersTab({
  jobs,
  quotes,
  templates,
  branding,
  onToast,
}: {
  jobs: Job[];
  quotes: Quote[];
  templates: Template[];
  branding: Branding | null;
  onToast: (msg: string) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<Job | Quote | null>(null);
  const [previewType, setPreviewType] = useState<"overdue_invoice" | "expiring_quote">("overdue_invoice");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [previewBody, setPreviewBody] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");

  function openPreview(item: Job | Quote, type: "overdue_invoice" | "expiring_quote") {
    setPreviewItem(item);
    setPreviewType(type);

    // Find best template for this type
    const t = templates.find((tm) => tm.type === type);

    const owing = (item.total_cost ?? 0) - (item.amount_paid ?? 0);

    const appUrl = typeof window !== "undefined" ? window.location.origin : "";
    const quoteUrl = ("public_token" in item && item.public_token)
      ? `${appUrl}/q/${item.public_token}`
      : `${appUrl}/q/${item.id}`;

    const vars: Record<string, string> = {
      client_name: item.client_name ?? "there",
      amount: String(owing),
      quote_url: quoteUrl,
      business_name: branding?.business_name ?? "",
      site_address: item.site_address ?? "your property",
    };

    const subj = applyTemplateVars(t?.subject ?? "Reminder", vars);
    const body = applyTemplateVars(t?.body ?? "", vars);
    setPreviewSubject(subj);
    setPreviewBody(body);
    setPreviewOpen(true);
  }

  async function sendOne(item: Job | Quote, type: "overdue_invoice" | "expiring_quote") {
    setSendingId(item.id);
    const res = await fetch("/api/comms/send-reminder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: item.id, type }),
    });
    setSendingId(null);
    if (res.ok) {
      onToast(type === "overdue_invoice" ? "Payment reminder sent" : "Quote reminder sent");
      setPreviewOpen(false);
    } else {
      onToast("Failed to send reminder");
    }
  }

  async function sendAll(items: Job[] | Quote[], type: "overdue_invoice" | "expiring_quote") {
    const allId = type === "overdue_invoice" ? "all-invoices" : "all-quotes";
    setSendingId(allId);
    for (const item of items) {
      setSendingId(item.id);
      const res = await fetch("/api/comms/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: item.id, type }),
      });
      if (!res.ok) {
        onToast(`Failed to send to ${item.client_name || "client"}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    setSendingId(null);
    onToast(`All ${type === "overdue_invoice" ? "payment" : "quote"} reminders sent`);
  }

  return (
    <div className="space-y-5">
      {/* Overdue Invoices */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-[18px] text-[var(--ink)] flex items-center gap-2">
            <AlertTriangle size={16} className="text-[var(--red)]" />
            Overdue Invoices
            <span className="pill bg-[var(--red-bg)] text-[var(--red)]">{jobs.length}</span>
          </h2>
          {jobs.length > 0 && (
            <button
              onClick={() => sendAll(jobs, "overdue_invoice")}
              disabled={sendingId === "all-invoices"}
              className="btn-primary text-[12.5px] py-1.5 px-3"
            >
              {sendingId === "all-invoices" ? "Sending..." : "Send All"}
            </button>
          )}
        </div>

        {jobs.length === 0 ? (
          <div className="card text-center py-8">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-[var(--green)]" />
            <p className="text-[13px] text-[var(--ink-faint)]">No overdue invoices. All caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => {
              const owing = (j.total_cost ?? 0) - (j.amount_paid ?? 0);
              const daysSince = daysAgo(j.completed_at);
              return (
                <div key={j.id} className="card flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14px] text-[var(--ink)] truncate">{j.client_name || "Unnamed client"}</p>
                    <p className="text-[12px] text-[var(--ink-faint)]">${owing.toLocaleString()} owing</p>
                    {daysSince != null && (
                      <p className="text-[11px] text-[var(--red)] font-semibold mt-0.5">{daysSince} days overdue</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openPreview(j, "overdue_invoice")}
                      className="btn-secondary text-[11px] py-1.5 px-2.5"
                    >
                      <Eye size={12} /> Preview
                    </button>
                    <button
                      onClick={() => sendOne(j, "overdue_invoice")}
                      disabled={sendingId === j.id}
                      className="btn-primary text-[11px] py-1.5 px-2.5"
                    >
                      <Send size={12} />
                      {sendingId === j.id ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Expiring Quotes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-[18px] text-[var(--ink)] flex items-center gap-2">
            <Bell size={16} className="text-amber-600" />
            Expiring Quotes
            <span className="pill bg-amber-50 text-amber-600">{quotes.length}</span>
          </h2>
          {quotes.length > 0 && (
            <button
              onClick={() => sendAll(quotes, "expiring_quote")}
              disabled={sendingId === "all-quotes"}
              className="btn-primary text-[12.5px] py-1.5 px-3"
            >
              {sendingId === "all-quotes" ? "Sending..." : "Send All"}
            </button>
          )}
        </div>

        {quotes.length === 0 ? (
          <div className="card text-center py-8">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-[var(--green)]" />
            <p className="text-[13px] text-[var(--ink-faint)]">No quotes expiring soon. All good!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => {
              const expDays = daysUntil(q.quote_expires_at);
              const owing = (q.total_cost ?? 0) - (q.amount_paid ?? 0);
              return (
                <div key={q.id} className="card flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14px] text-[var(--ink)] truncate">{q.client_name || "Unnamed client"}</p>
                    <p className="text-[12px] text-[var(--ink-faint)]">${owing.toLocaleString()}</p>
                    {expDays != null && (
                      <p className={`text-[11px] font-semibold mt-0.5 ${expDays < 0 ? "text-[var(--red)]" : "text-amber-600"}`}>
                        {expDays < 0 ? `${Math.abs(expDays)} days expired` : `${expDays} days until expiry`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openPreview(q, "expiring_quote")}
                      className="btn-secondary text-[11px] py-1.5 px-2.5"
                    >
                      <Eye size={12} /> Preview
                    </button>
                    <button
                      onClick={() => sendOne(q, "expiring_quote")}
                      disabled={sendingId === q.id}
                      className="btn-primary text-[11px] py-1.5 px-2.5"
                    >
                      <Send size={12} />
                      {sendingId === q.id ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Preview Modal */}
      {previewOpen && previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
              <h3 className="font-bold text-[15px] text-[var(--ink)]">Email Preview</h3>
              <button onClick={() => setPreviewOpen(false)} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <div className="mb-3">
                <label className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Subject</label>
                <p className="text-[13px] text-[var(--ink)] font-semibold mt-0.5">{previewSubject}</p>
              </div>
              <div className="mb-4">
                <label className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Body</label>
                <div className="bg-[var(--app-bg)] border border-[var(--line)] rounded-xl p-3 mt-0.5 text-[13px] text-[var(--ink-soft)] whitespace-pre-line">
                  {previewBody}
                </div>
              </div>

              {/* Styled preview */}
              <div className="border border-[var(--line)] rounded-xl overflow-hidden">
                <div
                  className="px-4 py-3"
                  style={{ background: branding?.branding_primary_color ?? "#ffb400" }}
                >
                  <p className="text-[12px] font-black tracking-wide" style={{ color: "#0a1722" }}>
                    {previewType === "overdue_invoice" ? "PAYMENT REMINDER" : "QUOTE REMINDER"}
                  </p>
                </div>
                <div className="bg-white p-4">
                  <p className="text-[13px] text-[#334155] whitespace-pre-line">{previewBody}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-[var(--line)]">
              <button onClick={() => setPreviewOpen(false)} className="btn-secondary text-[13px] py-2 px-4">
                Close
              </button>
              <button
                onClick={() => sendOne(previewItem, previewType)}
                disabled={sendingId === previewItem.id}
                className="btn-primary text-[13px] py-2 px-4 ml-auto"
              >
                <Send size={14} />
                {sendingId === previewItem.id ? "Sending..." : "Send Reminder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  TAB 2: Email Templates                                             */
/* ================================================================== */

 function TemplatesTab({
  templates,
  onUpdate,
  onToast,
}: {
  templates: Template[];
  onUpdate: (t: Template[]) => void;
  onToast: (msg: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editType, setEditType] = useState("custom");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const editModalRef = useRef<HTMLDivElement>(null);

  // Close modal on Escape key
  useEffect(() => {
    if (!editOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEditOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    // Focus the modal for accessibility
    editModalRef.current?.focus();
    // Prevent body scroll
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [editOpen]);

  function openCreate() {
    setEditId(null);
    setEditType("custom");
    setEditSubject("");
    setEditBody("");
    setEditOpen(true);
  }

  function openEdit(t: Template) {
    setEditId(t.id);
    setEditType(t.type);
    setEditSubject(t.subject);
    setEditBody(t.body);
    setEditOpen(true);
  }

  async function saveTemplate() {
    if (!editSubject.trim() || !editBody.trim()) return;
    setSaving(true);
    const res = await fetch("/api/comms/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editId, type: editType, subject: editSubject, body: editBody }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      if (editId) {
        onUpdate(templates.map((t) => (t.id === editId ? data.template : t)));
      } else {
        onUpdate([...templates, data.template]);
      }
      setEditOpen(false);
      onToast(editId ? "Template updated" : "Template created");
    } else {
      onToast("Failed to save template");
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/comms/templates?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      onUpdate(templates.filter((t) => t.id !== id));
      onToast("Template deleted");
    } else {
      onToast("Failed to delete template");
    }
  }

  function insertVar(v: string) {
    setEditBody((prev) => prev + " " + v);
  }

  const grouped = templates.reduce<Record<string, Template[]>>((acc, t) => {
    acc[t.type] = [...(acc[t.type] ?? []), t];
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[18px] text-[var(--ink)]">Email Templates</h2>
        <button onClick={openCreate} className="btn-primary text-[12.5px] py-1.5 px-3">
          <Plus size={13} /> Create template
        </button>
      </div>

      {templates.length === 0 && (
        <div className="card text-center py-10">
          <Mail size={24} className="mx-auto mb-2 text-[var(--ink-faint)]" />
          <p className="text-[13px] text-[var(--ink-faint)] mb-3">No templates yet.</p>
          <button onClick={openCreate} className="btn-primary text-[13px] py-2 px-4">
            Create your first template
          </button>
        </div>
      )}

      {Object.entries(grouped).map(([type, items]) => {
        const meta = TEMPLATE_TYPES[type] ?? TEMPLATE_TYPES.custom;
        return (
          <div key={type}>
            <h3 className={`text-[12px] font-bold uppercase tracking-wide mb-2 ${meta.color}`}>
              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: "currentColor" }} />
              {meta.label}
            </h3>
            <div className="space-y-2">
              {items.map((t) => (
                <div key={t.id} className="card">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`pill ${meta.bg} ${meta.color} text-[10px]`}>
                          {meta.label}
                        </span>
                        {t.is_default && (
                          <span className="pill bg-[var(--app-bg)] text-[var(--ink-faint)] text-[10px]">Default</span>
                        )}
                      </div>
                      <p className="font-semibold text-[13px] text-[var(--ink)] truncate">{t.subject}</p>
                      <p className="text-[12px] text-[var(--ink-faint)] truncate mt-0.5">
                        {t.body.slice(0, 120)}{t.body.length > 120 ? "..." : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-faint)] hover:text-[var(--navy)] hover:border-[var(--navy)]">
                        <Edit3 size={13} />
                      </button>
                      {!t.is_default && (
                        <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-faint)] hover:text-[var(--red)] hover:border-[var(--red)]">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Edit/Create Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}>
          <div ref={editModalRef} tabIndex={-1} className="bg-[var(--surface)] rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-[var(--line)] outline-none">
            <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
              <h3 className="font-bold text-[15px] text-[var(--ink)]">
                {editId ? "Edit Template" : "Create Template"}
              </h3>
              <button onClick={() => setEditOpen(false)} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {!editId && (
                <div>
                  <label className="text-[12px] font-bold text-[var(--ink-soft)] mb-1.5 block">Template Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="app-field text-[13px] py-2"
                  >
                    {Object.entries(TEMPLATE_TYPES).map(([key, meta]) => (
                      <option key={key} value={key}>{meta.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[12px] font-bold text-[var(--ink-soft)] mb-1.5 block">Subject</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="e.g. Payment reminder from {{business_name}}"
                  className="app-field text-[13px] py-2"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-[var(--ink-soft)] mb-1.5 block">Body</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={8}
                  placeholder="Write your email body here..."
                  className="app-field text-[13px] py-2 resize-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {VAR_HELPERS.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => insertVar(v.key)}
                      className="text-[10px] font-semibold text-[var(--navy)] bg-[var(--blue-bg)] border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-100 transition-colors"
                      title={v.desc}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-[var(--line)]">
              <button onClick={() => setEditOpen(false)} className="btn-secondary text-[13px] py-2 px-4">
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                disabled={saving || !editSubject.trim() || !editBody.trim()}
                className="btn-primary text-[13px] py-2 px-4 ml-auto"
              >
                <Save size={14} />
                {saving ? "Saving..." : editId ? "Save Changes" : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  TAB 3: Quote Branding                                              */
/* ================================================================== */

 function BrandingTab({
  branding,
  onUpdate,
  onToast,
}: {
  branding: Branding | null;
  onUpdate: (b: Branding | null) => void;
  onToast: (msg: string) => void;
}) {
  const [primaryColor, setPrimaryColor] = useState(branding?.branding_primary_color ?? "#ffb400");
  const [tagline, setTagline] = useState(branding?.branding_tagline ?? "");
  const [emailFooter, setEmailFooter] = useState(branding?.branding_email_footer ?? "Sent via Swiftscope");
  const [logoUrl, setLogoUrl] = useState(branding?.logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync from props
  useEffect(() => {
    if (branding) {
      setPrimaryColor(branding.branding_primary_color ?? "#ffb400");
      setTagline(branding.branding_tagline ?? "");
      setEmailFooter(branding.branding_email_footer ?? "Sent via Swiftscope");
      setLogoUrl(branding.logo_url ?? "");
    }
  }, [branding]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${user.id}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("logos").upload(path, file);
    if (upErr) { setUploading(false); onToast("Upload failed"); return; }

    const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
    setLogoUrl(publicUrl);
    setUploading(false);
    onToast("Logo uploaded");
    e.target.value = "";
  }

  async function saveBranding() {
    setSaving(true);
    const res = await fetch("/api/comms/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branding_primary_color: primaryColor,
        branding_tagline: tagline || null,
        branding_email_footer: emailFooter || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      onUpdate({ ...branding, branding_primary_color: primaryColor, branding_tagline: tagline, branding_email_footer: emailFooter, logo_url: logoUrl } as Branding);
      onToast("Branding saved");
    } else {
      onToast("Failed to save branding");
    }
  }

  const previewVars = {
    client_name: "Jane Smith",
    amount: "1250",
    quote_url: "https://swiftscope.app/q/abc123",
    business_name: branding?.business_name || "Your Business",
    site_address: "42 Main Street, Sydney",
  };

  const previewSubject = applyTemplateVars("Quote from {{business_name}} - ${{amount}}", previewVars);
  const previewBody = applyTemplateVars(
    "Hi {{client_name}},\n\n{{business_name}} has sent you a quote for the job at {{site_address}}.\n\nTap the button below to review and accept.",
    previewVars
  );

  return (
    <div className="space-y-5">
      <h2 className="font-display text-[18px] text-[var(--ink)]">Quote Branding</h2>

      {/* Logo Upload */}
      <div className="card">
        <label className="text-[12px] font-bold text-[var(--ink-soft)] uppercase tracking-wide mb-2 block">Business Logo</label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <div className="w-20 h-20 rounded-xl overflow-hidden border border-[var(--line)] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-xl bg-[var(--app-bg)] border border-[var(--line)] flex items-center justify-center">
              <Upload size={20} className="text-[var(--ink-faint)]" />
            </div>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-secondary text-[12px] py-1.5 px-3"
            >
              {uploading ? "Uploading..." : logoUrl ? "Change logo" : "Upload logo"}
            </button>
          </div>
        </div>
      </div>

      {/* Color Picker */}
      <div className="card">
        <label className="text-[12px] font-bold text-[var(--ink-soft)] uppercase tracking-wide mb-2 block">Primary Accent Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="w-10 h-10 rounded-lg border-2 border-[var(--line)] cursor-pointer"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="app-field text-[13px] py-2 w-28"
          />
          <div className="flex gap-1.5">
            {["#ffb400", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#0a1722"].map((c) => (
              <button
                key={c}
                onClick={() => setPrimaryColor(c)}
                className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div className="card">
        <label className="text-[12px] font-bold text-[var(--ink-soft)] uppercase tracking-wide mb-2 block">Business Tagline</label>
        <input
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="e.g. Quality electrical work since 2005"
          className="app-field text-[13px] py-2"
        />
      </div>

      {/* Email Footer */}
      <div className="card">
        <label className="text-[12px] font-bold text-[var(--ink-soft)] uppercase tracking-wide mb-2 block">Email Footer Text</label>
        <input
          type="text"
          value={emailFooter}
          onChange={(e) => setEmailFooter(e.target.value)}
          placeholder="e.g. Sent by Your Business"
          className="app-field text-[13px] py-2"
        />
      </div>

      {/* Live Preview */}
      <div className="card overflow-hidden">
        <label className="text-[12px] font-bold text-[var(--ink-soft)] uppercase tracking-wide mb-3 block">Live Preview</label>
        <div className="border border-[var(--line)] rounded-xl overflow-hidden">
          {/* Header */}
          <div className="bg-[var(--navy)] px-4 py-3">
            {logoUrl ? (
              <div className="h-10 w-32">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="logo" className="h-full w-full object-contain" />
              </div>
            ) : (
              <p className="font-display text-[16px] text-white tracking-wider">{(branding?.business_name || "YOUR BUSINESS").toUpperCase()}</p>
            )}
            {tagline && <p className="text-[10px] text-[var(--steel-3)] mt-0.5">{tagline}</p>}
          </div>
          {/* Accent bar */}
          <div className="px-4 py-2.5" style={{ background: primaryColor }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black tracking-wider" style={{ color: "#0a1722" }}>QUOTE</span>
              <span className="text-[18px] font-black" style={{ color: "#0a1722" }}>$1,250</span>
            </div>
          </div>
          {/* Body */}
          <div className="bg-white p-4">
            <p className="text-[13px] text-[#334155] whitespace-pre-line">{previewBody}</p>
            <div className="mt-4 text-center">
              <span className="inline-block px-5 py-2.5 rounded-lg text-[13px] font-black" style={{ background: primaryColor, color: "#0a1722" }}>
                Accept quote &amp; pay
              </span>
            </div>
          </div>
          {/* Footer */}
          <div className="bg-[var(--app-bg)] px-4 py-3 border-t border-[var(--line-subtle)]">
            <p className="text-[10px] text-[var(--ink-faint)] text-center">{emailFooter}</p>
          </div>
        </div>
      </div>

      <button onClick={saveBranding} disabled={saving} className="btn-primary w-full text-[14px] py-3">
        <Save size={15} />
        {saving ? "Saving..." : "Save Branding"}
      </button>
    </div>
  );
}

/* ================================================================== */
/*  TAB 4: Brochures                                                   */
/* ================================================================== */

 function BrochuresTab({ completedJobs, branding, quotes }: { completedJobs: Job[]; branding: Branding | null; quotes: Quote[] }) {
  const [showPreview, setShowPreview] = useState(false);
  const [title, setTitle] = useState(branding?.business_name || "Our Company");
  const [tagline, setTagline] = useState(branding?.branding_tagline || "");
  const [logoUrl, setLogoUrl] = useState(branding?.logo_url || "");
  const [accentColor, setAccentColor] = useState(branding?.branding_primary_color || "#0a1722");
  const [tcs, setTcs] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  /* Section toggles */
  const [showServices, setShowServices] = useState(true);
  const [showRecentWork, setShowRecentWork] = useState(true);
  const [showFromQuote, setShowFromQuote] = useState(false);
  const [showCustomContent, setShowCustomContent] = useState(true);
  const [customText, setCustomText] = useState("");

  /* Data sources */
  const [serviceMaterials, setServiceMaterials] = useState<Array<{ label: string; unit_cost: number; supplier?: string | null }>>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [quoteItems, setQuoteItems] = useState<Array<{ label: string; qty: number; total: number }>>([]);

  /* Website scraper */
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapedAbout, setScrapedAbout] = useState("");
  const [scrapedServices, setScrapedServices] = useState<string[]>([]);
  const [scrapedTestimonials, setScrapedTestimonials] = useState<Array<{ text: string; author?: string }>>([]);

  const supabase = createClient();

  /* Load service materials on mount */
  useEffect(() => {
    fetch("/api/comms/materials").then(r => r.json()).then(d => {
      if (d.items) setServiceMaterials(d.items);
    });
  }, []);

  /* Load quote materials when a quote is selected */
  useEffect(() => {
    if (!selectedQuoteId || !showFromQuote) { setQuoteItems([]); return; }
    supabase.from("quotes").select("intake_data, total_cost").eq("id", selectedQuoteId).single()
      .then(({ data }) => {
        if (data?.intake_data?.site_items) {
          const items = data.intake_data.site_items as Array<{ label: string; qty: number; materialsCost: number; labourHrs: number }>;
          setQuoteItems(items.map(it => ({
            label: it.label,
            qty: it.qty ?? 1,
            total: (it.materialsCost ?? 0) + (it.labourHrs ?? 0) * 95,
          })));
        } else if (data?.intake_data?.materials) {
          const items = data.intake_data.materials as Array<{ description: string; qty: number; total: number }>;
          setQuoteItems(items.map(it => ({
            label: it.description,
            qty: it.qty ?? 1,
            total: it.total ?? 0,
          })));
        }
      });
  }, [selectedQuoteId, showFromQuote, supabase]);

  async function scrapeWebsite() {
    if (!websiteUrl.trim()) return;
    setScrapeLoading(true);
    try {
      const res = await fetch("/api/comms/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.about) setScrapedAbout(data.about);
        if (data.services) setScrapedServices(data.services);
        if (data.testimonials) setScrapedTestimonials(data.testimonials);
        if (data.businessName && title === (branding?.business_name || "Our Company")) setTitle(data.businessName);
        if (data.logo && !logoUrl) setLogoUrl(data.logo);
        /* Merge into custom text */
        const parts: string[] = [];
        if (data.about) parts.push(data.about);
        if (data.services?.length) parts.push("Our Services:\n" + data.services.map((s: string) => "- " + s).join("\n"));
        if (data.testimonials?.length) {
          parts.push("What our clients say:\n" + data.testimonials.map((t: { text: string; author?: string }) =>
            `\"${t.text}\"${t.author ? " - " + t.author : ""}`).join("\n"));
        }
        if (parts.length) setCustomText(prev => prev ? prev + "\n\n" + parts.join("\n\n") : parts.join("\n\n"));
      }
    } catch { /* silently fail */ }
    setScrapeLoading(false);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/brochure/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { error } = await supabase.storage.from("brochure-images").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("brochure-images").getPublicUrl(path);
      setUploadedImages(prev => [...prev, publicUrl]);
    }
  }

  function removeImage(idx: number) { setUploadedImages(prev => prev.filter((_, i) => i !== idx)); }

  async function saveBrochure() {
    setSaving(true);
    const payload = {
      brochure_title: title,
      brochure_tagline: tagline,
      brochure_logo: logoUrl,
      brochure_color: accentColor,
      brochure_tcs: tcs,
      brochure_images: uploadedImages,
      brochure_sections: { showServices, showRecentWork, showFromQuote, showCustomContent },
      brochure_custom_text: customText,
    };
    await fetch("/api/comms/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
  }

  function handlePrint() { window.print(); }

  const colorPresets = ["#0a1722", "#1e40af", "#b45309", "#15803d", "#7c3aed", "#be123c", "#0e7490", "#4338ca"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[18px] text-[var(--ink)]">Company Brochure</h2>
        <button onClick={saveBrochure} disabled={saving} className="btn-primary text-[12px] py-1.5 px-3">
          <Save size={13} /> {saving ? "Saving..." : "Save Brochure"}
        </button>
      </div>

      <p className="text-[13px] text-[var(--ink-faint)]">Build one brochure with the sections you want. Toggle sections on/off below.</p>

      {/* --- Branding --- */}
      <div className="card space-y-4">
        <p className="section-tag">Branding</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Title</label>
            <input type="text" className="app-field" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Tagline</label>
            <input type="text" className="app-field" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Quality electrical work guaranteed" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Logo URL</label>
            <input type="text" className="app-field" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Accent Colour</label>
            <div className="flex flex-wrap gap-2">
              {colorPresets.map(c => (
                <button key={c} onClick={() => setAccentColor(c)}
                  className={`w-7 h-7 rounded-full border-2 ${accentColor === c ? "border-[var(--navy)] scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-7 h-7 rounded-full border border-[var(--line)] cursor-pointer" />
            </div>
          </div>
        </div>
      </div>

      {/* --- Sections toggles --- */}
      <div className="card space-y-3">
        <p className="section-tag">Sections</p>
        {/* Services */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={showServices} onChange={e => setShowServices(e.target.checked)} className="w-4 h-4 accent-[var(--navy)]" />
          <div>
            <p className="text-[13px] font-bold text-[var(--ink)]">Services List</p>
            <p className="text-[11px] text-[var(--ink-faint)]">Material pricing from your price book ({serviceMaterials.length} items)</p>
          </div>
        </label>
        {/* Recent Work */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={showRecentWork} onChange={e => setShowRecentWork(e.target.checked)} className="w-4 h-4 accent-[var(--navy)]" />
          <div>
            <p className="text-[13px] font-bold text-[var(--ink)]">Recent Work</p>
            <p className="text-[11px] text-[var(--ink-faint)]">Completed jobs ({completedJobs.length} jobs)</p>
          </div>
        </label>
        {/* From Quote */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={showFromQuote} onChange={e => setShowFromQuote(e.target.checked)} className="w-4 h-4 accent-[var(--navy)]" />
          <div className="flex-1">
            <p className="text-[13px] font-bold text-[var(--ink)]">From Quote</p>
            {showFromQuote && (
              <select className="app-field mt-1" value={selectedQuoteId} onChange={e => setSelectedQuoteId(e.target.value)} style={{ padding: "6px 10px", fontSize: "12px" }}>
                <option value="">Select a quote...</option>
                {quotes.map(q => (
                  <option key={q.id} value={q.id}>{q.client_name || "Unnamed"} - ${(q.total_cost ?? 0).toLocaleString()}</option>
                ))}
              </select>
            )}
          </div>
        </label>
        {/* Custom Content */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={showCustomContent} onChange={e => setShowCustomContent(e.target.checked)} className="w-4 h-4 accent-[var(--navy)]" />
          <div className="flex-1">
            <p className="text-[13px] font-bold text-[var](--ink)]">Custom Content</p>
          </div>
        </label>
      </div>

      {/* --- Custom content + scraper --- */}
      {showCustomContent && (
        <div className="card space-y-4">
          <p className="section-tag">Custom Content</p>
          {/* Website scraper */}
          <div>
            <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Scrape Your Website</label>
            <div className="flex gap-2">
              <input type="text" className="app-field flex-1" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://yourbusiness.com.au" />
              <button onClick={scrapeWebsite} disabled={scrapeLoading || !websiteUrl.trim()} className="btn-secondary shrink-0" style={{ width: "auto", padding: "8px 14px" }}>
                {scrapeLoading ? "Scraping..." : "Scrape"}
              </button>
            </div>
            <p className="text-[10px] text-[var(--ink-faint)] mt-1">Auto-fills about, services, testimonials</p>
          </div>
          {/* Content textarea */}
          <div>
            <label className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5">Brochure Text</label>
            <textarea className="app-field resize-none" rows={8} value={customText} onChange={e => setCustomText(e.target.value)} placeholder="Enter your brochure content..." />
          </div>
          {/* Scraped data preview */}
          {scrapedServices.length > 0 && (
            <div className="bg-[var(--app-bg)] rounded-lg p-3">
              <p className="text-[11px] font-bold text-[var(--ink-soft)] mb-1">Scraped Services</p>
              <div className="flex flex-wrap gap-1">
                {scrapedServices.map((s, i) => <span key={i} className="pill bg-[var(--blue-bg)] text-[var(--blue)] text-[10px]">{s}</span>)}
              </div>
            </div>
          )}
          {scrapedTestimonials.length > 0 && (
            <div className="bg-[var(--app-bg)] rounded-lg p-3 space-y-1">
              <p className="text-[11px] font-bold text-[var(--ink-soft)] mb-1">Scraped Testimonials</p>
              {scrapedTestimonials.map((t, i) => (
                <p key={i} className="text-[11px] text-[var(--ink-soft)] italic">&quot;{t.text}&quot;{t.author ? <span className="font-bold not-italic"> - {t.author}</span> : null}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Images --- */}
      <div className="card space-y-3">
        <p className="section-tag">Images</p>
        <div className="flex flex-wrap gap-2">
          {uploadedImages.map((img, i) => (
            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[var(--line)]">
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 bg-[var(--red)] text-white rounded-full p-0.5">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 border-2 border-dashed border-[var(--line)] rounded-xl py-3 px-4 cursor-pointer hover:border-[var(--amber)] transition-colors bg-[var(--app-bg)] w-fit">
          <Upload size={16} className="text-[var(--ink-faint)]" />
          <span className="text-[13px] font-semibold text-[var(--ink-soft)]">Add image</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>
      </div>

      {/* --- T&Cs --- */}
      <div className="card space-y-3">
        <p className="section-tag">Terms &amp; Conditions</p>
        <textarea className="app-field resize-none" rows={3} value={tcs} onChange={e => setTcs(e.target.value)} placeholder="e.g. Valid for 30 days. 50% deposit required..." />
      </div>

      {/* Generate button */}
      <button onClick={() => setShowPreview(true)} className="btn-primary w-full text-[14px] py-3">
        <Sparkles size={15} /> Preview Brochure
      </button>

      {/* --- Preview --- */}
      {showPreview && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[14px] text-[var(--ink)] flex items-center gap-2">
              <Eye size={14} /> Preview
            </h3>
            <button onClick={handlePrint} className="btn-primary text-[12px] py-1.5 px-3">
              <Download size={12} /> Print to PDF
            </button>
          </div>

          <div className="print-preview border border-[var(--line)] rounded-xl p-8 bg-white">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
              {logoUrl && <img src={logoUrl} alt="" className="h-14 w-auto object-contain" />}
              <div>
                <h1 className="font-display text-[28px] mb-0.5" style={{ color: accentColor }}>{title}</h1>
                {tagline && <p className="text-[13px] text-[var(--ink-soft)]">{tagline}</p>}
              </div>
            </div>
            <div className="w-20 h-1 mb-6" style={{ backgroundColor: accentColor }} />

            {/* Images */}
            {uploadedImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {uploadedImages.map((img, i) => (
                  <img key={i} src={img} alt="" className="rounded-xl object-cover w-full h-28" />
                ))}
              </div>
            )}

            {/* Custom Content */}
            {showCustomContent && customText && (
              <div className="mb-6">
                <div className="text-[13px] text-[var(--ink-soft)] whitespace-pre-line leading-relaxed">{customText}</div>
              </div>
            )}

            {/* Services */}
            {showServices && serviceMaterials.length > 0 && (
              <div className="mb-6">
                <h3 className="text-[14px] font-bold text-[var(--ink)] mb-3 flex items-center gap-2">
                  <span className="w-6 h-0.5" style={{ backgroundColor: accentColor }} />
                  Our Services
                </h3>
                <div className="space-y-1">
                  {serviceMaterials.slice(0, 20).map((m, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--line-subtle)]">
                      <div>
                        <p className="text-[12px] font-semibold text-[var(--ink)]">{m.label}</p>
                        {m.supplier && <p className="text-[10px] text-[var(--ink-faint)]">{m.supplier}</p>}
                      </div>
                      <p className="text-[12px] font-bold" style={{ color: accentColor }}>${Number(m.unit_cost).toFixed(2)}</p>
                    </div>
                  ))}
                  {serviceMaterials.length > 20 && (
                    <p className="text-[11px] text-[var(--ink-faint)] italic mt-1">...and {serviceMaterials.length - 20} more services</p>
                  )}
                </div>
              </div>
            )}

            {/* Recent Work */}
            {showRecentWork && completedJobs.length > 0 && (
              <div className="mb-6">
                <h3 className="text-[14px] font-bold text-[var(--ink)] mb-3 flex items-center gap-2">
                  <span className="w-6 h-0.5" style={{ backgroundColor: accentColor }} />
                  Recent Work
                </h3>
                <div className="space-y-2">
                  {completedJobs.slice(0, 10).map((j) => (
                    <div key={j.id} className="py-2 border-b border-[var(--line-subtle)]">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-semibold text-[var(--ink)]">{j.client_name || "Unnamed client"}</p>
                        <p className="text-[12px] font-bold" style={{ color: accentColor }}>${(j.total_cost ?? 0).toLocaleString()}</p>
                      </div>
                      {j.site_address && <p className="text-[10px] text-[var(--ink-faint)]">{j.site_address}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* From Quote */}
            {showFromQuote && selectedQuoteId && quoteItems.length > 0 && (
              <div className="mb-6">
                <h3 className="text-[14px] font-bold text-[var(--ink)] mb-3 flex items-center gap-2">
                  <span className="w-6 h-0.5" style={{ backgroundColor: accentColor }} />
                  Project Details
                </h3>
                <div className="space-y-1">
                  {quoteItems.map((m, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--line-subtle)]">
                      <p className="text-[12px] font-semibold text-[var(--ink)]">{m.qty}x {m.label}</p>
                      <p className="text-[12px] font-bold" style={{ color: accentColor }}>${m.total.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* T&Cs */}
            {tcs && (
              <div className="mt-6 pt-4 border-t border-[var(--line-subtle)]">
                <p className="text-[10px] text-[var(--ink-faint)] uppercase tracking-wide font-bold mb-1">Terms &amp; Conditions</p>
                <p className="text-[11px] text-[var(--ink-soft)] whitespace-pre-line">{tcs}</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-[var(--line)] text-center">
              {branding?.business_name && <p className="text-[12px] font-bold text-[var(--ink)]">{branding.business_name}</p>}
              {branding?.contact_phone && <p className="text-[11px] text-[var(--ink-soft)]">{branding.contact_phone}</p>}
              {branding?.contact_email && <p className="text-[11px] text-[var(--ink-soft)]">{branding.contact_email}</p>}
              <p className="text-[10px] text-[var(--ink-faint)] mt-2">
                Generated by Swiftscope - {new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ================================================================== */
/*  Shared helpers                                                     */
/* ================================================================== */

 function applyTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
