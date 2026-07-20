"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight,
  Mail, Phone, Globe, Star, Loader2, ExternalLink, Plus,
  Square, CheckSquare, SquareMinus, AlertTriangle, Download, ShieldCheck,
} from "lucide-react";
import { buildDirectorySlug } from "@/lib/seo/meta";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DirectoryListing {
  id: string;
  business_name: string;
  trades: string[];
  website_url: string | null;
  suburb: string | null;
  postcode: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  scraped_contact_email: string | null;
  scraped_contact_phone: string | null;
  private_email: string | null;
  blurb: string | null;
  logo_url: string | null;
  place_id: string | null;
  created_at: string;
  is_claimed: boolean;
  profile_id: string | null;
}

type TriState = "all" | "yes" | "no";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TRADES = [
  "electrician", "plumber", "carpenter", "roofer", "painter", "tiler",
  "landscaper", "concreter", "fencer", "plasterer", "handyman", "air conditioning",
  "builder", "arborist", "surveyor",
];

const PAGE_SIZES = [25, 50, 100];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminDirectoryPanel() {
  const [listings, setListings] = useState<DirectoryListing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);

  // Filters — tri-state: "all" | "yes" | "no"
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState<TriState>("all");
  const [phoneFilter, setPhoneFilter] = useState<TriState>("all");
  const [websiteFilter, setWebsiteFilter] = useState<TriState>("all");
  const [ratingFilter, setRatingFilter] = useState<TriState>("all");
  const [claimedFilter, setClaimedFilter] = useState<TriState>("all");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  // Export
  const [exportCount, setExportCount] = useState<number | "all">("all");
  const [exporting, setExporting] = useState(false);

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DirectoryListing>>({});
  const [saving, setSaving] = useState(false);

  // Deleting
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);

  // Add tradie -- for listings the scraper missed (a business too new to
  // be indexed yet, one with a weak web presence, etc.)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newListing, setNewListing] = useState({
    business_name: "", suburb: "", postcode: "", trades: [] as string[],
    website_url: "", scraped_contact_email: "", scraped_contact_phone: "", blurb: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / limit);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (tradeFilter) params.set("trade", tradeFilter);
    if (emailFilter !== "all") params.set("email", emailFilter);
    if (phoneFilter !== "all") params.set("phone", phoneFilter);
    if (websiteFilter !== "all") params.set("website", websiteFilter);
    if (ratingFilter !== "all") params.set("rating", ratingFilter);
    if (claimedFilter !== "all") params.set("claimed", claimedFilter);
    if (search.trim()) params.set("search", search.trim());

    try {
      const res = await fetch(`/api/admin/directory?${params}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, limit, tradeFilter, emailFilter, phoneFilter, websiteFilter, ratingFilter, claimedFilter, search]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [tradeFilter, emailFilter, phoneFilter, websiteFilter, ratingFilter, claimedFilter, search, limit]);

  // Selection helpers
  const allSelected = listings.length > 0 && listings.every((l) => selected.has(l.id));
  const someSelected = listings.some((l) => selected.has(l.id)) && !allSelected;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        listings.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        listings.forEach((l) => next.add(l.id));
        return next;
      });
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Edit
  function startEdit(l: DirectoryListing) {
    setEditingId(l.id);
    setEditForm({
      business_name: l.business_name,
      trades: [...l.trades],
      website_url: l.website_url,
      suburb: l.suburb,
      postcode: l.postcode,
      scraped_contact_email: l.scraped_contact_email,
      scraped_contact_phone: l.scraped_contact_phone,
      private_email: l.private_email,
      google_rating: l.google_rating,
      google_reviews_count: l.google_reviews_count,
      blurb: l.blurb,
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/directory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditForm({});
        fetchListings();
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  // Add tradie
  async function createListing() {
    if (!newListing.business_name.trim()) {
      setCreateError("Business name is required");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newListing),
      });
      const body = await res.json();
      if (!res.ok) {
        setCreateError(body.error || "Couldn't add that listing");
      } else {
        setShowAddForm(false);
        setNewListing({ business_name: "", suburb: "", postcode: "", trades: [], website_url: "", scraped_contact_email: "", scraped_contact_phone: "", blurb: "" });
        fetchListings();
      }
    } catch {
      setCreateError("Couldn't add that listing - try again");
    } finally {
      setCreating(false);
    }
  }

  // Send "claim your free listing" invites to selected unclaimed rows with
  // an email address on file (built for manually-added leads, e.g. from
  // hiPages -- not for bulk-emailing the whole Google Places directory)
  async function sendClaimInvites(ids: string[]) {
    setSendingInvites(true);
    setInviteResult(null);
    try {
      const res = await fetch("/api/admin/directory/send-claim-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteResult(data.error ?? "Failed to send invites");
      } else {
        const parts = [`${data.sent} sent`];
        if (data.skippedNoEmail) parts.push(`${data.skippedNoEmail} skipped (no email)`);
        if (data.skippedAlreadyClaimed) parts.push(`${data.skippedAlreadyClaimed} skipped (already claimed)`);
        if (data.failed) parts.push(`${data.failed} failed`);
        setInviteResult(parts.join(", "));
      }
    } catch {
      setInviteResult("Failed to send invites -- check your connection");
    } finally {
      setSendingInvites(false);
    }
  }

  // Delete
  async function doDelete(ids: string[]) {
    setDeletingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    try {
      const res = await fetch("/api/admin/directory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        setSelected((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        fetchListings();
      }
    } catch {
      // silently fail
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setConfirmDelete(null);
    }
  }

  // Export CSV -- same filters as the current view, but not limited to the
  // on-screen page: the tradie picks how many rows to pull.
  async function exportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("format", "csv");
      params.set("count", String(exportCount));
      if (tradeFilter) params.set("trade", tradeFilter);
      if (emailFilter !== "all") params.set("email", emailFilter);
      if (phoneFilter !== "all") params.set("phone", phoneFilter);
      if (websiteFilter !== "all") params.set("website", websiteFilter);
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      if (claimedFilter !== "all") params.set("claimed", claimedFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/directory?${params}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `swiftscope-directory-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setExporting(false);
    }
  }


  const activeFilterCount = [
    tradeFilter,
    emailFilter !== "all",
    phoneFilter !== "all",
    websiteFilter !== "all",
    ratingFilter !== "all",
    claimedFilter !== "all",
  ].filter(Boolean).length;

  function clearAllFilters() {
    setTradeFilter("");
    setEmailFilter("all");
    setPhoneFilter("all");
    setWebsiteFilter("all");
    setRatingFilter("all");
    setClaimedFilter("all");
    setSearch("");
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-[var(--ink)]">Directory listings</h1>
          <p className="text-[13px] text-[var(--ink-faint)]">{total.toLocaleString()} listing{total !== 1 ? "s" : ""} total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 bg-[var(--amber)] text-[var(--navy)] font-bold text-[12.5px] px-3 py-2 rounded-lg hover:brightness-95 transition-colors"
          >
            <Plus size={13} /> Add tradie
          </button>
          {selected.size > 0 && (
            <>
              <span className="text-[13px] font-semibold text-[var(--ink-soft)]">{selected.size} selected</span>
              <button
                onClick={() => sendClaimInvites(Array.from(selected))}
                disabled={sendingInvites}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-semibold text-[12.5px] px-3 py-2 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                {sendingInvites ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                Send claim invite
              </button>
              <button
                onClick={() => setConfirmDelete(Array.from(selected))}
                className="flex items-center gap-1.5 bg-red-50 text-red-600 font-semibold text-[12.5px] px-3 py-2 rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
              >
                <Trash2 size={13} /> Delete selected
              </button>
            </>
          )}
          {inviteResult && (
            <span className="text-[12.5px] font-semibold text-[var(--ink-soft)]">{inviteResult}</span>
          )}
          <select
            value={exportCount}
            onChange={(e) => setExportCount(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="app-field text-[13px] w-auto py-2"
          >
            <option value="all">Export all matching ({total.toLocaleString()})</option>
            {[25, 50, 100, 250, 500, 1000, 5000].map((n) => (
              <option key={n} value={n} disabled={n > total}>First {n.toLocaleString()}</option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            disabled={exporting || total === 0}
            className="flex items-center gap-1.5 bg-[var(--navy)] text-white font-bold text-[12.5px] px-3 py-2 rounded-lg hover:bg-[#0e2233] transition-colors disabled:opacity-40"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {exporting ? "Exporting..." : "Download CSV"}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-[var(--surface)] border-2 border-[var(--amber)] rounded-2xl p-4 mb-4">
          <p className="font-semibold text-[var(--ink)] mb-1">Add a tradie the scraper missed</p>
          <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">Google rating, review count, and photos are pulled in automatically from their business name + suburb. If you add a website, their email and logo are pulled from it too - useful when a business has little or no Google presence, which is usually why the scraper missed them in the first place.</p>
          {createError && <p className="text-[13px] text-red-600 mb-2">{createError}</p>}
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <input
              value={newListing.business_name}
              onChange={(e) => setNewListing((f) => ({ ...f, business_name: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="Business name *"
            />
            <select
              multiple
              value={newListing.trades}
              onChange={(e) => setNewListing((f) => ({ ...f, trades: Array.from(e.target.selectedOptions).map((o) => o.value) }))}
              className="app-field text-[13px] py-1"
              size={3}
            >
              {TRADES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              value={newListing.suburb}
              onChange={(e) => setNewListing((f) => ({ ...f, suburb: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="Suburb"
            />
            <input
              value={newListing.postcode}
              onChange={(e) => setNewListing((f) => ({ ...f, postcode: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="Postcode (auto-filled from suburb if left blank)"
            />
            <input
              value={newListing.website_url}
              onChange={(e) => setNewListing((f) => ({ ...f, website_url: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="Website"
            />
            <input
              value={newListing.scraped_contact_phone}
              onChange={(e) => setNewListing((f) => ({ ...f, scraped_contact_phone: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="Phone"
            />
            <input
              value={newListing.scraped_contact_email}
              onChange={(e) => setNewListing((f) => ({ ...f, scraped_contact_email: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="Email"
            />
            <input
              value={newListing.blurb}
              onChange={(e) => setNewListing((f) => ({ ...f, blurb: e.target.value }))}
              className="app-field text-[13px]"
              placeholder="Short blurb (optional)"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={createListing}
              disabled={creating}
              className="flex items-center gap-1.5 bg-[var(--navy)] text-white font-bold text-[12.5px] px-3 py-2 rounded-lg hover:bg-[#0e2233] transition-colors disabled:opacity-40"
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {creating ? "Adding..." : "Add to directory"}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setCreateError(null); }}
              className="text-[12.5px] font-semibold text-[var(--ink-faint)] hover:text-[var(--ink)] px-2 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4 mb-4 space-y-3">
        {/* Row 1: Search + Trade + Page size */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input
              type="text"
              placeholder="Search business, suburb, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="app-field pl-9 text-[13px] w-full"
            />
          </div>

          {/* Trade filter */}
          <select
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
            className="app-field text-[13px] w-auto"
          >
            <option value="">All trades</option>
            {TRADES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Page size */}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="app-field text-[13px] w-auto"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}/page</option>
            ))}
          </select>

          {/* Clear */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-[12.5px] font-semibold text-[var(--ink-faint)] hover:text-[var(--ink)] px-2 py-1.5"
            >
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Row 2: Tri-state filters */}
        <div className="flex flex-wrap gap-3">
          <TriStateFilter
            label="Email"
            value={emailFilter}
            onChange={setEmailFilter}
            icon={Mail}
          />
          <TriStateFilter
            label="Phone"
            value={phoneFilter}
            onChange={setPhoneFilter}
            icon={Phone}
          />
          <TriStateFilter
            label="Website"
            value={websiteFilter}
            onChange={setWebsiteFilter}
            icon={Globe}
          />
          <TriStateFilter
            label="Rating"
            value={ratingFilter}
            onChange={setRatingFilter}
            icon={Star}
          />
          <TriStateFilter
            label="Claimed"
            value={claimedFilter}
            onChange={setClaimedFilter}
            icon={ShieldCheck}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-[var(--amber-deep)] animate-spin" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <Search size={32} className="text-[var(--ink-faint)] mx-auto mb-3" />
            <p className="text-[15px] font-semibold text-[var(--ink)]">No listings found</p>
            <p className="text-[13px] text-[var(--ink-faint)] mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--app-bg)]">
                    <th className="text-left py-2.5 px-3 w-8">
                      <button onClick={toggleSelectAll} className="p-0.5">
                        {allSelected ? (
                          <CheckSquare size={15} className="text-[var(--amber-deep)]" />
                        ) : someSelected ? (
                          <SquareMinus size={15} className="text-[var(--amber-deep)]" />
                        ) : (
                          <Square size={15} className="text-[var(--ink-faint)]" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-2.5 px-3 font-bold text-[var(--ink-soft)]">Business</th>
                    <th className="text-left py-2.5 px-3 font-bold text-[var(--ink-soft)] w-32">Trade</th>
                    <th className="text-left py-2.5 px-3 font-bold text-[var(--ink-soft)] w-36">Suburb</th>
                    <th className="text-left py-2.5 px-3 font-bold text-[var(--ink-soft)] w-28">Contact</th>
                    <th className="text-right py-2.5 px-3 font-bold text-[var(--ink-soft)] w-20">Rating</th>
                    <th className="text-right py-2.5 px-3 font-bold text-[var(--ink-soft)] w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {listings.map((l) => {
                    const isEditing = editingId === l.id;
                    const isDeleting = deletingIds.has(l.id);

                    return (
                      <tr
                        key={l.id}
                        className={`transition-colors ${isDeleting ? "opacity-40" : "hover:bg-[var(--app-bg)]"} ${selected.has(l.id) ? "bg-[var(--amber-light)]/30" : ""}`}
                      >
                        {/* Checkbox */}
                        <td className="py-2.5 px-3">
                          <button onClick={() => toggleSelect(l.id)} className="p-0.5" disabled={isDeleting}>
                            {selected.has(l.id) ? (
                              <CheckSquare size={15} className="text-[var(--amber-deep)]" />
                            ) : (
                              <Square size={15} className="text-[var(--ink-faint)]" />
                            )}
                          </button>
                        </td>

                        {/* Business */}
                        <td className="py-2.5 px-3 min-w-[200px]">
                          {isEditing ? (
                            <input
                              value={editForm.business_name ?? ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, business_name: e.target.value }))}
                              className="app-field text-[12px] py-1 w-full"
                            />
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-[var(--ink)]">{l.business_name}</p>
                                {l.is_claimed && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">
                                    <ShieldCheck size={9} /> Claimed
                                  </span>
                                )}
                              </div>
                              {l.website_url && (
                                <a href={l.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                                  <ExternalLink size={9} /> {l.website_url.replace(/^https?:\/\//, "").slice(0, 30)}
                                </a>
                              )}
                              <br />
                              <a
                                href={`/directory/${buildDirectorySlug({ id: l.id, business_name: l.business_name, suburb: l.suburb ?? "" })}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-faint)] hover:underline"
                              >
                                <ExternalLink size={9} /> View live page
                              </a>
                            </>
                          )}
                        </td>

                        {/* Trade */}
                        <td className="py-2.5 px-3">
                          {isEditing ? (
                            <select
                              multiple
                              value={(editForm.trades as string[]) ?? []}
                              onChange={(e) => {
                                const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                                setEditForm((f) => ({ ...f, trades: opts }));
                              }}
                              className="app-field text-[11px] py-1 w-full"
                              size={3}
                            >
                              {TRADES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {l.trades.slice(0, 2).map((t) => (
                                <span key={t} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--app-bg)] border border-[var(--line-subtle)] capitalize">{t}</span>
                              ))}
                              {l.trades.length > 2 && (
                                <span className="text-[10px] text-[var(--ink-faint)]">+{l.trades.length - 2}</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Suburb */}
                        <td className="py-2.5 px-3">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <input
                                value={editForm.suburb ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, suburb: e.target.value }))}
                                className="app-field text-[11px] py-1 flex-1"
                                placeholder="Suburb"
                              />
                              <input
                                value={editForm.postcode ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, postcode: e.target.value }))}
                                className="app-field text-[11px] py-1 w-16"
                                placeholder="Postcode"
                              />
                            </div>
                          ) : (
                            <>
                              <p className="text-[var(--ink)]">{l.suburb ?? "-"}</p>
                              {l.postcode && <p className="text-[11px] text-[var(--ink-faint)]">{l.postcode}</p>}
                            </>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="py-2.5 px-3">
                          {isEditing ? (
                            <div className="space-y-1">
                              <input
                                value={editForm.scraped_contact_email ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, scraped_contact_email: e.target.value }))}
                                className="app-field text-[11px] py-1 w-full"
                                placeholder="Scraped email"
                              />
                              <input
                                value={editForm.scraped_contact_phone ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, scraped_contact_phone: e.target.value }))}
                                className="app-field text-[11px] py-1 w-full"
                                placeholder="Phone"
                              />
                              <input
                                value={editForm.private_email ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, private_email: e.target.value }))}
                                className="app-field text-[11px] py-1 w-full"
                                placeholder="Private email"
                              />
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              {l.scraped_contact_email ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-green-600">
                                  <Mail size={9} /> {l.scraped_contact_email.slice(0, 18)}{l.scraped_contact_email.length > 18 ? "..." : ""}
                                </span>
                              ) : l.private_email ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-blue-600">
                                  <Mail size={9} /> {l.private_email.slice(0, 18)}{l.private_email.length > 18 ? "..." : ""}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
                                  <Mail size={9} /> No email
                                </span>
                              )}
                              {l.scraped_contact_phone && (
                                <span className="block text-[11px] text-[var(--ink-soft)]">
                                  <Phone size={9} className="inline mr-0.5" />{l.scraped_contact_phone}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Rating */}
                        <td className="py-2.5 px-3 text-right">
                          {isEditing ? (
                            <div className="flex gap-1 justify-end">
                              <input
                                type="number"
                                step="0.1"
                                min={0}
                                max={5}
                                value={editForm.google_rating ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, google_rating: e.target.value ? Number(e.target.value) : null }))}
                                className="app-field text-[11px] py-1 w-14"
                                placeholder="Rating"
                              />
                              <input
                                type="number"
                                min={0}
                                value={editForm.google_reviews_count ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, google_reviews_count: e.target.value ? Number(e.target.value) : null }))}
                                className="app-field text-[11px] py-1 w-14"
                                placeholder="Reviews"
                              />
                            </div>
                          ) : l.google_rating ? (
                            <div>
                              <span className="font-bold text-[var(--amber-deep)]">{l.google_rating}</span>
                              <span className="text-[11px] text-[var(--ink-faint)] ml-1">({l.google_reviews_count ?? 0})</span>
                            </div>
                          ) : (
                            <span className="text-[var(--ink-faint)]">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={saveEdit} disabled={saving} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100">
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              </button>
                              <button onClick={() => { setEditingId(null); setEditForm({}); }} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => startEdit(l)} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] text-[var(--ink-faint)] hover:text-[var(--ink)]" title="Edit">
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => setConfirmDelete([l.id])}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--ink-faint)] hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--line-subtle)]">
              <p className="text-[12px] text-[var(--ink-faint)]">
                Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} of {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (page <= 3) pageNum = i + 1;
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = page - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`min-w-[28px] h-7 px-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                        pageNum === page
                          ? "bg-[var(--navy)] text-white"
                          : "hover:bg-[var(--app-bg)] text-[var(--ink-soft)]"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--surface)] rounded-2xl p-6 max-w-sm w-full mx-4 border border-[var(--line)] shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-red-500" />
              <h3 className="font-bold text-[15px] text-[var(--ink)]">Delete listing{confirmDelete.length > 1 ? "s" : ""}?</h3>
            </div>
            <p className="text-[13px] text-[var(--ink-soft)] mb-5">
              This will permanently delete {confirmDelete.length} listing{confirmDelete.length > 1 ? "s" : ""}.
              This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-secondary text-[12.5px] py-2"
              >
                Cancel
              </button>
              <button
                onClick={() => doDelete(confirmDelete)}
                className="bg-red-600 text-white font-semibold text-[12.5px] px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tri-State Filter — All | Has | No                                  */
/* ------------------------------------------------------------------ */

function TriStateFilter({
  label,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
  icon: typeof Mail;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-soft)] mr-0.5">
        <Icon size={11} className="text-[var(--amber)]" />
        {label}
      </span>
      <div className="flex rounded-lg border border-[var(--line)] overflow-hidden">
        <button
          onClick={() => onChange("all")}
          className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
            value === "all"
              ? "bg-[var(--navy)] text-white"
              : "bg-white text-[var(--ink-faint)] hover:bg-[var(--app-bg)]"
          }`}
        >
          All
        </button>
        <button
          onClick={() => onChange("yes")}
          className={`px-2 py-1 text-[11px] font-semibold border-l border-[var(--line)] transition-colors ${
            value === "yes"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-white text-[var(--ink-faint)] hover:bg-[var(--app-bg)]"
          }`}
        >
          Has
        </button>
        <button
          onClick={() => onChange("no")}
          className={`px-2 py-1 text-[11px] font-semibold border-l border-[var(--line)] transition-colors ${
            value === "no"
              ? "bg-red-50 text-red-600 border-red-200"
              : "bg-white text-[var(--ink-faint)] hover:bg-[var(--app-bg)]"
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}
