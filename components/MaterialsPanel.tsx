"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Box, Building2, Package, Tag, Layers, ShoppingBag, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import MaterialsCatalog, { MaterialModal, CsvUploadModal } from "./materials/MaterialsCatalog";
import SuppliersView from "./materials/SuppliersView";
import PackagesView from "./materials/PackagesView";
import PricingTiersView from "./materials/PricingTiersView";
import JobSizeTiersView from "./materials/JobSizeTiersView";
import MaterialBundlesView from "./materials/MaterialBundlesView";
import DocketRateItemsView from "./materials/DocketRateItemsView";
import type { Material, Supplier, Pkg, PackageRow, PricingTier, JobSizeTier, MaterialBundle } from "./materials/shared";
import { PAGE_SIZE } from "./materials/shared";

const DEFAULT_HOURLY_RATE = 95;

export default function MaterialsPanel() {
  const router = useRouter();
  const supabase = createClient();

  /* --- Tabs --- */
  const [activeTab, setActiveTab] = useState<"materials" | "suppliers" | "packages" | "pricing" | "bundles" | "dockets">("materials");

  /* --- Pricing sub-tabs --- */
  const [pricingSubTab, setPricingSubTab] = useState<"tiers" | "sizes">("tiers");

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

  /* --- Pricing tiers state --- */
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [pricingTiersLoading, setPricingTiersLoading] = useState(true);

  /* --- Job size tiers state --- */
  const [jobSizeTiers, setJobSizeTiers] = useState<JobSizeTier[]>([]);
  const [jobSizeTiersLoading, setJobSizeTiersLoading] = useState(true);

  /* --- Bundles state --- */
  const [bundles, setBundles] = useState<MaterialBundle[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(true);

  /* --- Shared --- */
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
      // Packages and the hourly-rate lookup below use `businessId`
      // directly via client-side Supabase calls (unlike Materials/
      // Suppliers/Pricing tiers/Job size tiers/Bundles, which all go
      // through /api/* routes that already resolve this server-side).
      // For a solo owner account user.id and the business id are the
      // same, so using the raw id here was invisible - but for a team
      // member they're NOT the same, and using user.id meant any package
      // a team member created got siloed under their own individual id:
      // invisible to the business owner, other team members, and the
      // quote builder itself (which correctly resolves the shared
      // business id via getActiveBusinessId).
      const resolvedBusinessId = await getActiveBusinessId(supabase, user.id);
      setBusinessId(resolvedBusinessId);

      const { data: profile } = await supabase
        .from("profiles")
        .select("hourly_rate")
        .eq("id", resolvedBusinessId)
        .single();
      if (profile?.hourly_rate) {
        setHourlyRate(profile.hourly_rate);
      }

      await loadPackages(resolvedBusinessId);
      setPackagesLoading(false);

      await loadPricingTiers();
      setPricingTiersLoading(false);

      await loadJobSizeTiers();
      setJobSizeTiersLoading(false);

      await loadBundles();
      setBundlesLoading(false);
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

  /* --- Load pricing tiers --- */
  async function loadPricingTiers() {
    setPricingTiersLoading(true);
    try {
      const res = await fetch("/api/pricing-tiers");
      if (!res.ok) throw new Error("Failed to load pricing tiers");
      const data = await res.json();
      setPricingTiers(data.tiers ?? []);
    } catch (err: unknown) {
      console.error("Error loading pricing tiers:", err);
    } finally {
      setPricingTiersLoading(false);
    }
  }

  /* --- Load job size tiers --- */
  async function loadJobSizeTiers() {
    setJobSizeTiersLoading(true);
    try {
      const res = await fetch("/api/job-size-tiers");
      if (!res.ok) throw new Error("Failed to load job size tiers");
      const data = await res.json();
      setJobSizeTiers(data.tiers ?? []);
    } catch (err: unknown) {
      console.error("Error loading job size tiers:", err);
    } finally {
      setJobSizeTiersLoading(false);
    }
  }

  /* --- Load bundles --- */
  async function loadBundles() {
    setBundlesLoading(true);
    try {
      const res = await fetch("/api/material-bundles");
      if (!res.ok) throw new Error("Failed to load bundles");
      const data = await res.json();
      setBundles(data.bundles ?? []);
    } catch (err: unknown) {
      console.error("Error loading bundles:", err);
    } finally {
      setBundlesLoading(false);
    }
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

  useEffect(() => {
    if (activeTab === "pricing") {
      loadPricingTiers();
      loadJobSizeTiers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "bundles") {
      loadBundles();
    }
  }, [activeTab]);

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
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--line)] overflow-x-auto hide-scrollbar -mx-4 px-4 pr-2 sm:mx-0 sm:px-0">
        {[
          { key: "materials" as const, label: "Materials", icon: Box },
          { key: "suppliers" as const, label: "Suppliers", icon: Building2 },
          { key: "packages" as const, label: "Packages", icon: Package },
          { key: "pricing" as const, label: "Pricing", icon: Tag },
          { key: "bundles" as const, label: "Bundles", icon: ShoppingBag },
          { key: "dockets" as const, label: "Dayworks", icon: Clock },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-bold border-b-2 transition-colors shrink-0 whitespace-nowrap ${
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
        {/* Trailing spacer so the last tab always has real breathing room
            before the screen edge, instead of the row's own edge-bleed
            padding being the only thing standing between "Bundles" and
            the literal edge of the phone - which read as a broken/cut-off
            layout even though the tab itself wasn't actually clipped. */}
        <div className="w-4 shrink-0 sm:hidden" aria-hidden="true" />
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
          pricingTiers={pricingTiers}
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

      {/* ---- Tab 4: Pricing ---- */}
      {activeTab === "pricing" && (
        <div>
          {/* Sub-tab bar */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { key: "tiers" as const, label: "Customer Tiers", icon: Tag },
              { key: "sizes" as const, label: "Job Sizes", icon: Layers },
            ].map((sub) => {
              const active = pricingSubTab === sub.key;
              return (
                <button
                  key={sub.key}
                  onClick={() => setPricingSubTab(sub.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold rounded-xl border transition-colors ${
                    active
                      ? "border-[var(--amber)] bg-[var(--amber-light)] text-[var(--amber-deep)]"
                      : "border-[var(--line)] bg-transparent text-[var(--ink-faint)] hover:text-[var(--ink-soft)] hover:bg-[var(--app-bg)]"
                  }`}
                >
                  <sub.icon size={14} strokeWidth={active ? 2.5 : 1.8} />
                  {sub.label}
                </button>
              );
            })}
          </div>

          {pricingSubTab === "tiers" && (
            <PricingTiersView
              tiers={pricingTiers}
              loading={pricingTiersLoading}
              onTiersChanged={() => loadPricingTiers()}
            />
          )}

          {pricingSubTab === "sizes" && (
            <JobSizeTiersView
              tiers={jobSizeTiers}
              loading={jobSizeTiersLoading}
              onTiersChanged={() => loadJobSizeTiers()}
            />
          )}
        </div>
      )}

      {/* ---- Tab 5: Bundles ---- */}
      {activeTab === "bundles" && (
        <MaterialBundlesView
          bundles={bundles}
          loading={bundlesLoading}
          businessId={businessId}
          onBundlesChanged={() => loadBundles()}
        />
      )}

      {activeTab === "dockets" && <DocketRateItemsView />}

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
