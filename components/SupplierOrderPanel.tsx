"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingCart, Send, Plus, Trash2, Check, Building2 } from "lucide-react";

export type OrderLine = {
  id: string;
  label: string;
  qty: number;
  unit: string;
  supplier: string;
  sku: string;
  unit_cost: number;
  selected: boolean;
  job_line_item_id?: string | null;
};

type BookItem = {
  id: string;
  description: string;
  supplier: string | null;
  sku: string | null;
  unit: string | null;
  cost_price: number | null;
};

type SupplierContact = {
  id: string;
  supplier_name: string;
  email: string;
  phone: string | null;
  account_number: string | null;
};

type SendLog = {
  id: string;
  supplier_name: string;
  recipient_email: string;
  subject: string;
  line_items: unknown;
  fulfillment: string;
  needed_by: string | null;
  send_method: string;
  sent_at: string;
};

type JobLineSeed = {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  status: string;
};

function uid() {
  return `ol_${Math.random().toString(36).slice(2, 10)}`;
}

function matchBook(label: string, book: BookItem[]): BookItem | null {
  const q = label.trim().toLowerCase();
  if (!q) return null;
  const exact = book.find((b) => b.description.trim().toLowerCase() === q);
  if (exact) return exact;
  return book.find((b) => b.description.toLowerCase().includes(q) || q.includes(b.description.toLowerCase())) ?? null;
}

function seedLines(jobLines: JobLineSeed[], book: BookItem[], scopeFallback: string[]): OrderLine[] {
  const fromJob = jobLines
    .filter((l) => !["installed", "complete"].includes(l.status))
    .map((l) => {
      const hit = matchBook(l.label, book);
      return {
        id: uid(),
        label: l.label,
        qty: Number(l.quantity) || 1,
        unit: l.unit || hit?.unit || "ea",
        supplier: hit?.supplier?.trim() || "Unassigned",
        sku: hit?.sku ?? "",
        unit_cost: Number(hit?.cost_price ?? 0),
        selected: l.status === "not_started" || l.status === "materials_ordered",
        job_line_item_id: l.id,
      } satisfies OrderLine;
    });

  if (fromJob.length) return fromJob;

  return scopeFallback.map((label) => {
    const hit = matchBook(label, book);
    return {
      id: uid(),
      label,
      qty: 1,
      unit: hit?.unit || "ea",
      supplier: hit?.supplier?.trim() || "Unassigned",
      sku: hit?.sku ?? "",
      unit_cost: Number(hit?.cost_price ?? 0),
      selected: true,
      job_line_item_id: null,
    };
  });
}

export default function SupplierOrderPanel({
  jobId,
  jobNumber,
  clientName,
  siteAddress,
  scopeLines,
  jobLineItems,
  tradeMaterials,
  trade,
}: {
  jobId: string;
  quoteId?: string | null;
  jobNumber: number;
  clientName?: string | null;
  siteAddress?: string | null;
  scopeLines: string[];
  jobLineItems: JobLineSeed[];
  tradeMaterials: Array<{ item_key: string; label: string; unit_cost: number }>;
  trade?: string | null;
}) {
  const [book, setBook] = useState<BookItem[]>([]);
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [sends, setSends] = useState<SendLog[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [metaReady, setMetaReady] = useState(false);

  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [neededBy, setNeededBy] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [activeSupplier, setActiveSupplier] = useState<string | null>(null);
  const [emailBySupplier, setEmailBySupplier] = useState<Record<string, string>>({});
  const [accountBySupplier, setAccountBySupplier] = useState<Record<string, string>>({});
  const [saveContact, setSaveContact] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [addQuery, setAddQuery] = useState("");

  const loadMeta = useCallback(async () => {
    const bookQs = new URLSearchParams({ limit: "500" });
    if (trade) bookQs.set("trade", trade);
    try {
      const [bookRes, contactsRes, sendsRes] = await Promise.all([
        fetch(`/api/materials?${bookQs}`),
        fetch("/api/supplier-contacts"),
        fetch(`/api/jobs/${jobId}/supplier-orders`),
      ]);
      if (bookRes.ok) {
        const data = await bookRes.json();
        setBook(
          (data.materials ?? []).map((m: {
            id: string;
            description: string;
            supplier: string | null;
            sku: string | null;
            unit: string | null;
            cost_price: number | null;
          }) => ({
            id: m.id,
            description: m.description,
            supplier: m.supplier,
            sku: m.sku,
            unit: m.unit,
            cost_price: m.cost_price,
          }))
        );
      }
      if (contactsRes.ok) {
        const data = await contactsRes.json();
        setContacts(data.contacts ?? []);
      }
      if (sendsRes.ok) {
        const data = await sendsRes.json();
        setSends(data.sends ?? []);
      }
    } finally {
      setMetaReady(true);
    }
  }, [jobId, trade]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (seeded || !metaReady) return;
    const bookOrTrade: BookItem[] =
      book.length > 0
        ? book
        : tradeMaterials.map((m) => ({
            id: m.item_key,
            description: m.label,
            supplier: null,
            sku: null,
            unit: "ea",
            cost_price: m.unit_cost,
          }));
    setLines(seedLines(jobLineItems, bookOrTrade, scopeLines));
    setSeeded(true);
  }, [book, tradeMaterials, jobLineItems, scopeLines, seeded, metaReady]);

  // Prefill emails + account numbers from saved contacts when suppliers change
  useEffect(() => {
    setEmailBySupplier((prev) => {
      const next = { ...prev };
      for (const c of contacts) {
        if (!next[c.supplier_name]) next[c.supplier_name] = c.email;
      }
      return next;
    });
    setAccountBySupplier((prev) => {
      const next = { ...prev };
      for (const c of contacts) {
        if (c.account_number && !next[c.supplier_name]) next[c.supplier_name] = c.account_number;
      }
      return next;
    });
  }, [contacts]);

  const suppliers = useMemo(() => {
    const names = Array.from(new Set(lines.filter((l) => l.selected).map((l) => l.supplier || "Unassigned")));
    return names.sort((a, b) => a.localeCompare(b));
  }, [lines]);

  const selectedCount = lines.filter((l) => l.selected).length;

  function updateLine(id: string, patch: Partial<OrderLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function addFromBook(item: BookItem) {
    setLines((prev) => [
      ...prev,
      {
        id: uid(),
        label: item.description,
        qty: 1,
        unit: item.unit || "ea",
        supplier: item.supplier?.trim() || "Unassigned",
        sku: item.sku ?? "",
        unit_cost: Number(item.cost_price ?? 0),
        selected: true,
        job_line_item_id: null,
      },
    ]);
    setAddQuery("");
  }

  function addBlank() {
    setLines((prev) => [
      ...prev,
      {
        id: uid(),
        label: "",
        qty: 1,
        unit: "ea",
        supplier: suppliers[0] || "Unassigned",
        sku: "",
        unit_cost: 0,
        selected: true,
        job_line_item_id: null,
      },
    ]);
  }

  const addResults = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return book.filter((b) => b.description.toLowerCase().includes(q) || (b.sku ?? "").toLowerCase().includes(q)).slice(0, 8);
  }, [addQuery, book]);

  async function sendSupplier(supplier: string) {
    const supplierLines = lines.filter((l) => l.selected && (l.supplier || "Unassigned") === supplier && l.label.trim());
    const email = (emailBySupplier[supplier] ?? "").trim();
    if (!email || supplierLines.length === 0) {
      setMessage("Add a supplier email and at least one selected line.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/supplier-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: supplier,
          recipientEmail: email,
          fulfillment,
          neededBy: neededBy || null,
          deliveryNotes: deliveryNotes || null,
          accountNumber: (accountBySupplier[supplier] ?? "").trim() || null,
          saveContact,
          markOrdered: true,
          preferMailto: false,
          lines: supplierLines.map((l) => ({
            label: l.label,
            qty: l.qty,
            unit: l.unit,
            sku: l.sku || null,
            unit_cost: l.unit_cost || null,
            job_line_item_id: l.job_line_item_id ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");

      if (data.sendMethod === "mailto" && data.mailto) {
        window.location.href = data.mailto;
        setMessage(`Opened email draft for ${supplier}. Logged on this job.`);
      } else {
        setMessage(`Sent to ${supplier} (${email}).${data.markedOrdered ? ` Marked ${data.markedOrdered} line(s) ordered.` : ""}`);
      }
      if (data.warning) setMessage((m) => `${m ?? ""} ${data.warning}`);

      // Deselect sent lines locally
      setLines((prev) =>
        prev.map((l) =>
          l.selected && (l.supplier || "Unassigned") === supplier ? { ...l, selected: false } : l
        )
      );
      setActiveSupplier(null);
      await loadMeta();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <p className="section-tag mb-1">Materials &amp; suppliers</p>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="font-semibold text-[var(--ink)]">Order list for this job</p>
          <p className="text-[12.5px] text-[var(--ink-faint)]">
            Job #{jobNumber}
            {clientName ? ` · ${clientName}` : ""}
            {siteAddress ? ` · ${siteAddress}` : ""}
          </p>
        </div>
        <span className="text-[12px] text-[var(--ink-faint)] font-semibold shrink-0">
          {selectedCount} selected
        </span>
      </div>

      <div className="grid sm:grid-cols-3 gap-2 mt-3 mb-3">
        <label className="block">
          <span className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1">Fulfilment</span>
          <select
            value={fulfillment}
            onChange={(e) => setFulfillment(e.target.value as "pickup" | "delivery")}
            className="app-field text-[13px]"
          >
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1">Needed by</span>
          <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className="app-field text-[13px]" />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1">Notes for supplier</span>
          <input
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            placeholder="Gate code, leave at side…"
            className="app-field text-[13px]"
          />
        </label>
      </div>

      {lines.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-faint)] flex items-center gap-2 mt-2">
          <ShoppingCart size={14} /> Nothing on the list yet — add from your book below.
        </p>
      ) : (
        <div className="space-y-2 mt-1">
          {lines.map((line) => (
            <div key={line.id} className="border border-[var(--line)] rounded-xl p-2.5 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={line.selected}
                  onChange={(e) => updateLine(line.id, { selected: e.target.checked })}
                  className="mt-1.5 shrink-0"
                />
                <input
                  value={line.label}
                  onChange={(e) => updateLine(line.id, { label: e.target.value })}
                  className="app-field text-[13px] flex-1"
                  placeholder="Item description"
                />
                <button onClick={() => removeLine(line.id)} className="text-[var(--ink-faint)] p-1.5" aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pl-6">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={line.qty}
                  onChange={(e) => updateLine(line.id, { qty: Number(e.target.value) || 0 })}
                  className="app-field text-[12.5px]"
                  placeholder="Qty"
                />
                <input
                  value={line.unit}
                  onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                  className="app-field text-[12.5px]"
                  placeholder="Unit"
                />
                <input
                  value={line.supplier}
                  onChange={(e) => updateLine(line.id, { supplier: e.target.value })}
                  className="app-field text-[12.5px]"
                  placeholder="Supplier"
                  list="supplier-name-options"
                />
                <input
                  value={line.sku}
                  onChange={(e) => updateLine(line.id, { sku: e.target.value })}
                  className="app-field text-[12.5px]"
                  placeholder="SKU"
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={line.unit_cost || ""}
                  onChange={(e) => updateLine(line.id, { unit_cost: Number(e.target.value) || 0 })}
                  className="app-field text-[12.5px]"
                  placeholder="$ cost"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <datalist id="supplier-name-options">
        {Array.from(new Set([...book.map((b) => b.supplier).filter(Boolean), ...contacts.map((c) => c.supplier_name)])).map(
          (name) => (
            <option key={String(name)} value={String(name)} />
          )
        )}
      </datalist>

      <div className="mt-3 relative">
        <input
          value={addQuery}
          onChange={(e) => setAddQuery(e.target.value)}
          placeholder="Search price book to add…"
          className="app-field text-[13px]"
        />
        {addResults.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg overflow-hidden">
            {addResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addFromBook(item)}
                className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--app-bg)] border-b border-[var(--line-subtle)] last:border-0"
              >
                <span className="font-semibold text-[var(--ink)]">{item.description}</span>
                <span className="text-[var(--ink-faint)] ml-2">
                  {item.supplier ?? "No supplier"} · ${Number(item.cost_price ?? 0).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" onClick={addBlank} className="btn-secondary text-[12.5px] py-2 px-3">
          <Plus size={13} /> Add blank line
        </button>
      </div>

      {suppliers.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Send by supplier</p>
          {suppliers.map((supplier) => {
            const count = lines.filter((l) => l.selected && (l.supplier || "Unassigned") === supplier).length;
            const open = activeSupplier === supplier;
            const contactOpts = contacts.filter((c) => c.supplier_name === supplier);
            return (
              <div key={supplier} className="border border-[var(--line)] rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={14} className="text-[var(--amber-deep)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-[var(--ink)] truncate">{supplier}</p>
                      <p className="text-[11.5px] text-[var(--ink-faint)]">{count} item{count === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSupplier(open ? null : supplier)}
                    className="btn-secondary text-[12px] py-1.5 px-3"
                  >
                    <Send size={12} /> {open ? "Close" : "Send"}
                  </button>
                </div>
                {open && (
                  <div className="mt-3 space-y-2">
                    {contactOpts.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const chosen = contactOpts.find((c) => c.email === e.target.value);
                          setEmailBySupplier((prev) => ({ ...prev, [supplier]: e.target.value }));
                          if (chosen?.account_number) {
                            setAccountBySupplier((prev) => ({ ...prev, [supplier]: chosen.account_number! }));
                          }
                        }}
                        className="app-field text-[13px]"
                      >
                        <option value="">Saved contacts…</option>
                        {contactOpts.map((c) => (
                          <option key={c.id} value={c.email}>
                            {c.email}{c.account_number ? ` · #${c.account_number}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="email"
                      value={emailBySupplier[supplier] ?? ""}
                      onChange={(e) => setEmailBySupplier((prev) => ({ ...prev, [supplier]: e.target.value }))}
                      placeholder="supplier@email.com"
                      className="app-field text-[13px]"
                    />
                    <input
                      value={accountBySupplier[supplier] ?? ""}
                      onChange={(e) => setAccountBySupplier((prev) => ({ ...prev, [supplier]: e.target.value }))}
                      placeholder="Your customer / account # with this supplier"
                      className="app-field text-[13px]"
                    />
                    <label className="flex items-center gap-2 text-[12.5px] text-[var(--ink-soft)]">
                      <input type="checkbox" checked={saveContact} onChange={(e) => setSaveContact(e.target.checked)} />
                      Save email &amp; account # for {supplier}
                    </label>
                    <p className="text-[11.5px] text-[var(--ink-faint)]">
                      Business name, trading name, and person ordering come from{" "}
                      <a href="/settings" className="underline font-semibold text-[var(--ink-soft)]">Settings</a>.
                    </p>
                    <button
                      type="button"
                      disabled={busy || !(emailBySupplier[supplier] ?? "").trim()}
                      onClick={() => sendSupplier(supplier)}
                      className="btn-primary text-[12.5px] py-2 px-4 disabled:opacity-50"
                    >
                      {busy ? "Sending…" : "Send order"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {message && (
        <p className="text-[12.5px] text-[var(--ink-faint)] mt-3 flex items-start gap-1.5">
          <Check size={13} className="mt-0.5 shrink-0 text-[var(--green)]" />
          {message}
        </p>
      )}

      {sends.length > 0 && (
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-2">Send log</p>
          <div className="space-y-1.5">
            {sends.slice(0, 8).map((s) => (
              <div key={s.id} className="text-[12.5px] text-[var(--ink-soft)] flex flex-wrap gap-x-2">
                <span className="font-semibold text-[var(--ink)]">{s.supplier_name}</span>
                <span>→ {s.recipient_email}</span>
                <span className="text-[var(--ink-faint)]">
                  {new Date(s.sent_at).toLocaleString("en-AU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-[var(--ink-faint)]">
                  ({s.send_method}
                  {Array.isArray(s.line_items) ? ` · ${s.line_items.length} lines` : ""})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
