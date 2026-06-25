"use client";

import { useState } from "react";
import Link from "next/link";

type Quote = {
  id: string;
  client_name: string | null;
  client_email: string | null;
  site_address: string | null;
  status: string;
  total_cost: number | null;
  invoice_number: string | null;
  xero_exported_at: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-amber-100 text-amber-800",
  declined: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
};

export default function QuotesList({ quotes: initialQuotes }: { quotes: Quote[] }) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const acceptedNotExported = quotes.filter((q) => q.status === "accepted" && !q.xero_exported_at);

  async function setStatus(quoteId: string, status: string) {
    setBusyId(quoteId);
    const res = await fetch("/api/quotes/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId, status }),
    });
    if (res.ok) {
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status } : q)));
    }
    setBusyId(null);
  }

  async function exportToXero() {
    setExporting(true);
    setExportMessage(null);
    const res = await fetch("/api/quotes/export-xero-csv");
    if (res.status === 404) {
      setExportMessage("No accepted quotes ready to export.");
      setExporting(false);
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setExportMessage(body.error ?? "Export failed");
      setExporting(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xero-import-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportMessage(`Exported ${acceptedNotExported.length} invoice(s). Import this file in Xero under Business > Invoices > Import.`);
    setQuotes((prev) =>
      prev.map((q) => (q.status === "accepted" && !q.xero_exported_at ? { ...q, xero_exported_at: new Date().toISOString() } : q))
    );
    setExporting(false);
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Quotes</h1>
        <Link href="/electrician" className="text-sm text-blue-600">
          New quote
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium mb-1">Track in Xero</p>
        <p className="text-xs text-neutral-600 mb-3">
          {acceptedNotExported.length > 0
            ? `${acceptedNotExported.length} accepted quote(s) ready to export.`
            : "No accepted quotes waiting on export right now."}{" "}
          Downloads a CSV you import directly in Xero — no Xero account connection needed.
        </p>
        <button
          onClick={exportToXero}
          disabled={exporting || acceptedNotExported.length === 0}
          className="bg-amber-600 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {exporting ? "Exporting..." : "Export accepted quotes to Xero CSV"}
        </button>
        {exportMessage && <p className="text-xs text-neutral-600 mt-2">{exportMessage}</p>}
      </div>

      <div className="space-y-3">
        {quotes.length === 0 && <p className="text-sm text-neutral-500">No quotes yet.</p>}
        {quotes.map((q) => (
          <div key={q.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-sm">{q.client_name || "Unnamed client"}</p>
                <p className="text-xs text-neutral-500">{q.site_address}</p>
                {q.invoice_number && (
                  <p className="text-xs text-neutral-400 font-mono mt-1">{q.invoice_number}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-medium text-sm">${(q.total_cost ?? 0).toLocaleString()}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[q.status] ?? ""}`}>
                  {q.status}
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {q.status === "sent" && (
                <button
                  onClick={() => setStatus(q.id, "accepted")}
                  disabled={busyId === q.id}
                  className="text-xs border rounded-md px-3 py-1 disabled:opacity-40"
                >
                  Mark accepted
                </button>
              )}
              {q.status === "accepted" && (
                <button
                  onClick={() => setStatus(q.id, "paid")}
                  disabled={busyId === q.id}
                  className="text-xs border rounded-md px-3 py-1 disabled:opacity-40"
                >
                  Mark paid
                </button>
              )}
              {(q.status === "sent" || q.status === "draft") && (
                <button
                  onClick={() => setStatus(q.id, "declined")}
                  disabled={busyId === q.id}
                  className="text-xs border rounded-md px-3 py-1 text-red-600 disabled:opacity-40"
                >
                  Mark declined
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
