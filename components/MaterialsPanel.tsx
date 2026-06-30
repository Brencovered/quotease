"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Box, Building2, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MaterialsCatalog, { MaterialModal, CsvUploadModal } from "./materials/MaterialsCatalog";
import SuppliersView from "./materials/SuppliersView";
import PackagesView from "./materials/PackagesView";
import type { Material, Supplier, Pkg, PackageRow } from "./materials/shared";
import { PAGE_SIZE } from "./materials/shared";

const DEFAULT_HOURLY_RATE = 95;

export default function MaterialsPanel() {
  const router = useRouter();
  const supabase = createClient();

  /* --- Tabs --- */
  const [activeTab, setActiveTab] = useState<"materials" | "suppliers" | "packages">("materials");

  /* --- Materials tab state --- */
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMaterials, setTotalMaterials] = useState(0);

  /* --- Suppliers tab state --- */
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);

  /* --- Packages tab state --- */
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState(DEFAULT_HOURLY_RATE);

  /* --- Shared modals --- */
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  /* --- Dropdowns --- */
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  /* --- Auth --- */
  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setBusinessId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("hourly_rate")
        .eq("id", user.id)
        .single();
      if (profile?.hourly_rate) {
        setHourlyRate(profile.hourly_rate);
      }

      await loadPackages(user.id);
      setPackagesLoading(false);
    }
    init();
  }, [router, supabase]);

  /* --- Load materials --- */
  const loadMaterials = useCallback(async () => {
    setMaterialsLoading(true);
    setMaterialsError("");
    try {
      const params = new URLSearchParams();
      if (supplierFilter) params.set("supplier", supplierFilter);
      if (tradeFilter) params.set("trade", tradeFilter);
      if (searchQuery) params.set("q", searchQuery);
      params.set("page", String(currentPage));
      params.set("limit", String(PAGE_SIZE));

      const res = await fetch(`/api/materials?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load materials");
      const data = await res.json();
      setMaterials(data.materials ?? []);
      setTotalMaterials(data.total ?? data.materials?.length ?? 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMaterialsError(message);
    } finally {
      setMaterialsLoading(false);
    }
  }, [supplierFilter, tradeFilter, searchQuery, currentPage]);

  /* --- Load suppliers --- */
  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      const res = await fetch("/api/materials/suppliers");
      if (!res.ok) throw new Error("Failed to load suppliers");
      const data = await res.json();
      setSuppliers(data.suppliers ?? []);
    } catch {
      // silently fail
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  /* --- Load packages --- */
  async function loadPackages(bid: string) {
    const { data, error } = await supabase
      .from("packages")
      .select("*, package_items(*)")
      .eq("profile_id", bid)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading packages:", error);
      return;
    }

    const transformed: Pkg[] = (data ?? []).map((row: PackageRow) => ({
      ...row,
      package_items: row.package_items ?? [],
      use_count: 0,
    }));

    setPackages(transformed);
  }

  /* --- Initial data load --- */
  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  useEffect(() => {
    if (activeTab === "suppliers") {
      loadSuppliers();
    }
  }, [activeTab, loadSuppliers]);

  /* --- Derived --- */
  const totalPages = Math.max(1, Math.ceil(totalMaterials / PAGE_SIZE));
  const totalInventoryValue = suppliers.reduce((sum, s) => sum + (s.total_value || 0), 0);

  /* --- Material CRUD --- */
  async function handleDeleteMaterial(id: string) {
    try {
      const res = await fetch(`/api/materials?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      setTotalMaterials((prev) => prev - 1);
      setOpenMenuId(null);
    } catch (err: unknown) {
      console.error("Delete error:", err);
    }
  }

  /* --- Filter by supplier from suppliers tab --- */
  function filterBySupplier(supplierName: string) {
    setSupplierFilter(supplierName);
    setActiveTab("materials");
    setCurrentPage(1);
  }

  /* ================================================================ */
  /*  RENDER                                                            */
  /* ================================================================ */

  return (
    <div className="page-wrap">
      {/* ---- Tab Bar ---- */}
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--line)]">
        {[
          { key: "materials" as const, label: "Materials", icon: Box },
          { key: "suppliers" as const, label: "Suppliers", icon: Building2 },
          { key: "packages" as const, label: "Packages", icon: Package },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-bold border-b-2 transition-colors ${
                active
                  ? "border-[var(--amber)] text-[var(--amber-deep)]"
                  : "border-transparent text-[var(--ink-faint)] hover:text-[var(--ink-soft)]"
              }`}
            >
              <tab.icon size={15} strokeWidth={active ? 2.5 : 1.8} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ---- Tab 1: Materials ---- */}
      {activeTab === "materials" && (
        <MaterialsCatalog
          materials={materials}
          loading={materialsLoading}
          error={materialsError}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          supplierFilter={supplierFilter}
          setSupplierFilter={setSupplierFilter}
          tradeFilter={tradeFilter}
          setTradeFilter={setTradeFilter}
          suppliers={suppliers}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          totalMaterials={totalMaterials}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onAddMaterial={() => {
            setEditingMaterial(null);
            setMaterialModalOpen(true);
          }}
          onEditMaterial={(m) => {
            setEditingMaterial(m);
            setMaterialModalOpen(true);
          }}
          onDeleteMaterial={handleDeleteMaterial}
          onOpenCsvUpload={() => setCsvModalOpen(true)}
        />
      )}

      {/* ---- Tab 2: Suppliers ---- */}
      {activeTab === "suppliers" && (
        <SuppliersView
          suppliers={suppliers}
          loading={suppliersLoading}
          totalMaterials={totalMaterials}
          totalInventoryValue={totalInventoryValue}
          onFilterBySupplier={filterBySupplier}
        />
      )}

      {/* ---- Tab 3: Packages ---- */}
      {activeTab === "packages" && (
        <PackagesView
          packages={packages}
          loading={packagesLoading}
          businessId={businessId}
          hourlyRate={hourlyRate}
          supabase={supabase}
          onPackagesChanged={(bid) => loadPackages(bid)}
        />
      )}

      {/* ---- Material Modal ---- */}
      {materialModalOpen && (
        <MaterialModal
          material={editingMaterial}
          onClose={() => {
            setMaterialModalOpen(false);
            setEditingMaterial(null);
          }}
          onSaved={() => {
            setMaterialModalOpen(false);
            setEditingMaterial(null);
            loadMaterials();
          }}
        />
      )}

      {/* ---- CSV Upload Modal ---- */}
      {csvModalOpen && (
        <CsvUploadModal
          onClose={() => setCsvModalOpen(false)}
          onImported={() => {
            setCsvModalOpen(false);
            loadMaterials();
          }}
        />
      )}
    </div>
  );
}
