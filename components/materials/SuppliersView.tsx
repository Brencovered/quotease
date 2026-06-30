"use client";

import { Loader2, Box, Building2, DollarSign, ChevronRight } from "lucide-react";
import type { Supplier } from "./shared";
import { formatCurrency } from "./shared";

/* ------------------------------------------------------------------ */
/*  TAB 2: SUPPLIERS                                                   */
/* ------------------------------------------------------------------ */

interface SuppliersTabProps {
  suppliers: Supplier[];
  loading: boolean;
  totalMaterials: number;
  totalInventoryValue: number;
  onFilterBySupplier: (name: string) => void;
}

export default function SuppliersView({
  suppliers,
  loading,
  totalMaterials,
  totalInventoryValue,
  onFilterBySupplier,
}: SuppliersTabProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-[26px] text-[var(--ink)]">Suppliers</h1>
        <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">Overview of your material sources</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--blue-bg)] flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-[var(--blue)]" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{suppliers.length}</div>
            <div className="text-[12px] text-[var(--ink-faint)]">Suppliers</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--amber-light)] flex items-center justify-center shrink-0">
            <Box size={18} className="text-[var(--amber-deep)]" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{totalMaterials}</div>
            <div className="text-[12px] text-[var(--ink-faint)]">Total materials</div>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--green-bg)] flex items-center justify-center shrink-0">
            <DollarSign size={18} className="text-[var(--green)]" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-[var(--ink)] leading-tight">{formatCurrency(totalInventoryValue)}</div>
            <div className="text-[12px] text-[var(--ink-faint)]">Total inventory value</div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[var(--amber)]" />
        </div>
      )}

      {/* Empty */}
      {!loading && suppliers.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--line-subtle)] flex items-center justify-center mb-4">
            <Building2 size={28} className="text-[var(--ink-faint)]" />
          </div>
          <h3 className="font-display text-[20px] text-[var(--ink)] mb-1">No suppliers yet</h3>
          <p className="text-[13px] text-[var(--ink-faint)] max-w-sm">Add materials to see suppliers here.</p>
        </div>
      )}

      {/* Supplier cards grid */}
      {!loading && suppliers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s, i) => (
            <div
              key={s.name}
              className="card reveal cursor-pointer hover:shadow-md transition-shadow"
              style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
              onClick={() => onFilterBySupplier(s.name)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--amber-light)] flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-[var(--amber-deep)]" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterBySupplier(s.name);
                  }}
                  className="btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "11px", width: "auto" }}
                >
                  View materials
                  <ChevronRight size={12} />
                </button>
              </div>
              <h3 className="text-[15px] font-bold text-[var(--ink)] mt-3 truncate">{s.name}</h3>
              <div className="flex items-center gap-4 mt-2">
                <div className="text-[12px] text-[var(--ink-soft)]">
                  <span className="font-bold text-[var(--ink)]">{s.count}</span> materials
                </div>
                <div className="text-[12px] text-[var(--ink-soft)]">
                  <span className="font-bold text-[var(--ink)] tabular">{formatCurrency(s.total_value)}</span> value
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
