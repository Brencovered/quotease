"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight,
  Mail, Phone, Globe, Star, Loader2, ExternalLink,
  Square, CheckSquare, SquareMinus, AlertTriangle,
} from "lucide-react";

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
}

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

  // Filters
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [hasRating, setHasRating] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DirectoryListing>>({});
  const [saving, setSaving] = useState(false);

  // Deleting
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);

  const totalPages = Math.ceil(total / limit);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (tradeFilter) params.set("trade", tradeFilter);
    if (hasEmail) params.set("hasEmail", "true");
    if (hasPhone) params.set("hasPhone", "true");
    if (hasWebsite) params.set("hasWebsite", "true");
    if (hasRating) params.set("hasRating", "true");
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
  }, [page, limit, tradeFilter, hasEmail, hasPhone, hasWebsite, hasRating, search]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [tradeFilter, hasEmail, hasPhone, hasWebsite, hasRating, search, limit]);

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

  // Active filters count
  const activeFilterCount = [tradeFilter, hasEmail, hasPhone, hasWebsite, hasRating].filter(Boolean).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-[var(--ink)]">Directory listings</h1>
          <p className="text-[13px] text-[var(--ink-faint)]">{total.toLocaleString()} listing{total !== 1 ? "s" : ""} total</p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--ink-soft)]">{selected.size} selected</span>
            <button
              onClick={() => setConfirmDelete(Array.from(selected))}
              className="flex items-center gap-1.5 bg-red-50 text-red-600 font-semibold text-[12.5px] px-3 py-2 rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
            >
              <Trash2 size={13} /> Delete selected
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4 mb-4">
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

          {/* Has toggles */}
          <div className="flex flex-wrap gap-1.5">
            <FilterToggle active={hasEmail} onClick={() => setHasEmail((v) => !v)} icon={Mail} label="Email" />
            <FilterToggle active={hasPhone} onClick={() => setHasPhone((v) => !v)} icon={Phone} label="Phone" />
            <FilterToggle active={hasWebsite} onClick={() => setHasWebsite((v) => !v)} icon={Globe} label="Web" />
            <FilterToggle active={hasRating} onClick={() => setHasRating((v) => !v)} icon={Star} label="Rating" />
          </div>

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
              onClick={() => {
                setTradeFilter("");
                setHasEmail(false);
                setHasPhone(false);
                setHasWebsite(false);
                setHasRating(false);
                setSearch("");
              }}
              className="text-[12.5px] font-semibold text-[var(--ink-faint)] hover:text-[var(--ink)] px-2 py-1.5"
            >
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
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
                              <p className="font-semibold text-[var(--ink)]">{l.business_name}</p>
                              {l.website_url && (
                                <a href={l.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                                  <ExternalLink size={9} /> {l.website_url.replace(/^https?:\/\//, "").slice(0, 30)}
                                </a>
                              )}
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
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FilterToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Mail;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-semibold transition-all ${
        active
          ? "border-[var(--amber)] bg-[var(--amber-light)] text-[var(--amber-deep)]"
          : "border-[var(--line)] bg-white text-[var(--ink-faint)] hover:border-[var(--ink-faint)]"
      }`}
    >
      <Icon size={11} />
      {label}
    </button>
  );
}
