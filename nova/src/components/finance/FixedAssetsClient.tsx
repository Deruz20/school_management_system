"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Search,
  Calendar,
  Layers
} from "lucide-react";

export interface AssetItemRow {
  id: string;
  assetTag: string;
  name: string;
  description?: string | null;
  categoryId: string;
  locationId?: string | null;
  custodianId?: string | null;
  serialNumber?: string | null;
  modelNumber?: string | null;
  purchaseDate: string;
  capitalizationDate: string;
  status: string;
  condition: string;
  capitalizationSource: string;
  acquisitionCost: string | number;
  salvageValue: string | number;
  accumulatedDepreciation: string | number;
  netBookValue: string | number;
  depreciationMethod?: string | null;
  usefulLifeMonths?: number | null;
  annualDepreciationRate?: string | number | null;
  category: { code: string; name: string; categoryType: string };
  location?: { code: string; name: string } | null;
  custodian?: { firstName: string; lastName: string; employeeCode: string } | null;
  transportVehicle?: { registrationNumber: string; makeModel: string } | null;
  disposalRecord?: { disposalType: string; disposalProceeds: string | number; gainOrLossAmount: string | number } | null;
}

export interface AssetCategoryRow {
  id: string;
  code: string;
  name: string;
  categoryType: string;
  depreciationMethod: string;
  usefulLifeMonths: number;
  annualDepreciationRate: string | number;
  defaultSalvagePercent: string | number;
  glAssetAccountId?: string | null;
  glDepreciationAccountId?: string | null;
  glAccumDeprecAccountId?: string | null;
  glAssetAccount?: { code: string; name: string } | null;
  glDepreciationAccount?: { code: string; name: string } | null;
  glAccumDeprecAccount?: { code: string; name: string } | null;
}

export interface AssetLocationRow {
  id: string;
  code: string;
  name: string;
  building?: string | null;
  roomNumber?: string | null;
}

export interface DepreciationRunRow {
  id: string;
  runNumber: string;
  periodId: string;
  runDate: string;
  status: string;
  totalAssetsCount: number;
  totalDepreciationAmount: string | number;
  fiscalPeriod: { name: string; status: string };
  createdBy: { firstName: string; lastName: string };
  approvedBy?: { firstName: string; lastName: string } | null;
  journalEntryId?: string | null;
}

export interface TreasuryAccountOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  currentBalance: string | number;
}

export interface FiscalPeriodOption {
  id: string;
  periodNumber: number;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface ReconciliationData {
  isReconciled: boolean;
  asOfDate: string | Date;
  subledger: {
    activeAssetsCount: number;
    totalGrossCost: string | number;
    totalAccumDeprec: string | number;
    totalNetBookValue: string | number;
  };
  generalLedger: {
    glGrossPPE: string | number;
    glAccumDeprec: string | number;
    glNetBookValue: string | number;
  };
  variance: {
    costVariance: string | number;
    accumVariance: string | number;
    nbvVariance: string | number;
  };
}

export interface FixedAssetsClientProps {
  summary: {
    totalAssetsCount: number;
    activeAssetsCount: number;
    fullyDepreciatedCount: number;
    disposedCount: number;
    totalGrossCost: string | number;
    totalAccumDeprec: string | number;
    totalNetBookValue: string | number;
  };
  initialAssets: AssetItemRow[];
  categories: AssetCategoryRow[];
  locations: AssetLocationRow[];
  runs: DepreciationRunRow[];
  treasuryAccounts: TreasuryAccountOption[];
  fiscalPeriods: FiscalPeriodOption[];
  initialReconciliation: ReconciliationData;
  currentUserId: string;
}

export function FixedAssetsClient({
  summary: initialSummary,
  initialAssets,
  categories,
  locations,
  runs: initialRuns,
  treasuryAccounts,
  fiscalPeriods,
  initialReconciliation
}: FixedAssetsClientProps) {
  const [activeTab, setActiveTab] = useState<"register" | "depreciation" | "disposals" | "reconcile" | "categories">("register");
  const [assets, setAssets] = useState<AssetItemRow[]>(initialAssets);
  const [runs, setRuns] = useState<DepreciationRunRow[]>(initialRuns);
  const [summary, setSummary] = useState(initialSummary);
  const [reconciliation, setReconciliation] = useState(initialReconciliation);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals state
  const [showDirectPurchaseModal, setShowDirectPurchaseModal] = useState(false);
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);
  const [showDisposalModal, setShowDisposalModal] = useState(false);
  const [showNewRunModal, setShowNewRunModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetItemRow | null>(null);

  // Form states
  const [directForm, setDirectForm] = useState({
    name: "",
    categoryId: categories[0]?.id || "",
    treasuryAccountId: treasuryAccounts[0]?.id || "",
    locationId: locations[0]?.id || "",
    purchaseDate: new Date().toISOString().split("T")[0],
    capitalizationDate: new Date().toISOString().split("T")[0],
    acquisitionCost: "",
    salvageValue: "0",
    serialNumber: "",
    description: ""
  });

  const [bootstrapForm, setBootstrapForm] = useState({
    name: "",
    assetTag: "",
    categoryId: categories[0]?.id || "",
    purchaseDate: new Date().toISOString().split("T")[0],
    capitalizationDate: new Date().toISOString().split("T")[0],
    acquisitionCost: "",
    accumulatedDepreciation: "0",
    salvageValue: "0",
    serialNumber: ""
  });

  const [disposalForm, setDisposalForm] = useState({
    disposalDate: new Date().toISOString().split("T")[0],
    disposalType: "SALE",
    disposalProceeds: "0",
    treasuryAccountId: treasuryAccounts[0]?.id || "",
    reason: "",
    buyerDetails: ""
  });

  const [runPeriodId, setRunPeriodId] = useState(fiscalPeriods.find(p => p.status === "OPEN")?.id || "");
  const [runNotes, setRunNotes] = useState("");

  const refreshData = async () => {
    try {
      const res = await fetch("/api/finance/assets");
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets);
        setSummary(data.summary);
      }
      const runsRes = await fetch("/api/finance/assets/depreciation/runs");
      if (runsRes.ok) {
        const data = await runsRes.json();
        setRuns(data.runs);
      }
      const reconRes = await fetch("/api/finance/assets/reconcile");
      if (reconRes.ok) {
        const data = await reconRes.json();
        setReconciliation(data);
      }
    } catch {
      // ignore
    }
  };

  const handleDirectPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/finance/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capitalizationSource: "DIRECT_PURCHASE",
            name: directForm.name,
            categoryId: directForm.categoryId,
            treasuryAccountId: directForm.treasuryAccountId,
            locationId: directForm.locationId || undefined,
            purchaseDate: directForm.purchaseDate,
            capitalizationDate: directForm.capitalizationDate,
            acquisitionCost: directForm.acquisitionCost,
            salvageValue: directForm.salvageValue,
            serialNumber: directForm.serialNumber || undefined,
            description: directForm.description || undefined
          })
        });

        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg);
        }

        setActionSuccess("Capital asset successfully registered and capitalized with GL & Treasury postings.");
        setShowDirectPurchaseModal(false);
        await refreshData();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Failed to capitalize asset.");
      }
    });
  };

  const handleBootstrapAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/finance/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capitalizationSource: "OPENING_BALANCE",
            name: bootstrapForm.name,
            assetTag: bootstrapForm.assetTag || undefined,
            categoryId: bootstrapForm.categoryId,
            purchaseDate: bootstrapForm.purchaseDate,
            capitalizationDate: bootstrapForm.capitalizationDate,
            acquisitionCost: bootstrapForm.acquisitionCost,
            accumulatedDepreciation: bootstrapForm.accumulatedDepreciation,
            salvageValue: bootstrapForm.salvageValue,
            serialNumber: bootstrapForm.serialNumber || undefined
          })
        });

        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg);
        }

        setActionSuccess("Opening balance asset successfully imported with balanced Equity entry.");
        setShowBootstrapModal(false);
        await refreshData();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Failed to import opening asset.");
      }
    });
  };

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/finance/assets/depreciation/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodId: runPeriodId,
            notes: runNotes
          })
        });

        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg);
        }

        setActionSuccess("Depreciation batch run created and submitted for Four-Eye review.");
        setShowNewRunModal(false);
        await refreshData();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Failed to create depreciation run.");
      }
    });
  };

  const handleRunAction = async (runId: string, action: "APPROVE" | "REJECT" | "POST_GL", reason?: string) => {
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/finance/assets/depreciation/runs/${runId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason })
        });

        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg);
        }

        setActionSuccess(`Depreciation run action (${action}) completed successfully.`);
        await refreshData();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  };

  const handleDisposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/finance/assets/disposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetId: selectedAsset.id,
            disposalDate: disposalForm.disposalDate,
            disposalType: disposalForm.disposalType,
            disposalProceeds: disposalForm.disposalProceeds,
            treasuryAccountId: disposalForm.disposalType === "SALE" ? disposalForm.treasuryAccountId : undefined,
            reason: disposalForm.reason,
            buyerDetails: disposalForm.buyerDetails || undefined
          })
        });

        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg);
        }

        setActionSuccess(`Asset ${selectedAsset.assetTag} successfully retired/disposed with GL & Treasury entries.`);
        setShowDisposalModal(false);
        setSelectedAsset(null);
        await refreshData();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Failed to dispose asset.");
      }
    });
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch =
      a.assetTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.serialNumber && a.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "ALL" || a.categoryId === selectedCategory;
    const matchesStatus = selectedStatus === "ALL" || a.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Fixed Assets & Depreciation Engine</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Subledger v3.1M Authoritative
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Capital Asset Register, Straight-Line & Reducing-Balance Depreciation, Four-Eye Controls & Telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowBootstrapModal(true)}
            className="inline-flex items-center px-3.5 py-2 text-sm font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
          >
            <Layers className="w-4 h-4 mr-1.5 text-slate-600" />
            Opening Assets
          </button>
          <button
            onClick={() => setShowNewRunModal(true)}
            className="inline-flex items-center px-3.5 py-2 text-sm font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
          >
            <Calendar className="w-4 h-4 mr-1.5 text-indigo-600" />
            New Deprec Run
          </button>
          <button
            onClick={() => setShowDirectPurchaseModal(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Acquire Asset
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">Action Failed</div>
            <div className="text-sm">{actionError}</div>
          </div>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm font-medium">{actionSuccess}</div>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Asset Value (Cost)</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            UGX {Number(summary.totalGrossCost).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {summary.activeAssetsCount} active capital items
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accumulated Depreciation</div>
          <div className="text-2xl font-bold text-amber-600 mt-2">
            UGX {Number(summary.totalAccumDeprec).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {summary.fullyDepreciatedCount} fully depreciated
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Book Value (Balance Sheet)</div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            UGX {Number(summary.totalNetBookValue).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Cost less accumulated depreciation
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subledger / GL Telemetry</div>
          <div className="flex items-center gap-2 mt-2">
            {reconciliation?.isReconciled ? (
              <>
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <span className="text-base font-bold text-emerald-700">Zero Drift (Balanced)</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-6 h-6 text-rose-600" />
                <span className="text-base font-bold text-rose-700">Variance Detected</span>
              </>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {reconciliation?.isReconciled ? "Subledger exactly equals GL #1500 & #1600" : "Discrepancy requires reconciliation"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8">
          {[
            { id: "register", label: "Asset Register", count: assets.length },
            { id: "depreciation", label: "Depreciation Engine", count: runs.length },
            { id: "reconcile", label: "GL Reconciliation & Telemetry" },
            { id: "categories", label: "Categories & Locations" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "register" | "depreciation" | "disposals" | "reconcile" | "categories")}
              className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-semibold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1: ASSET REGISTER */}
      {activeTab === "register" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tag, name, serial..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="FULLY_DEPRECIATED">FULLY_DEPRECIATED</option>
                <option value="IN_REPAIR">IN_REPAIR</option>
                <option value="DISPOSED">DISPOSED</option>
                <option value="WRITTEN_OFF">WRITTEN_OFF</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Tag & Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Location / Custodian</th>
                    <th className="px-4 py-3 text-right">Cost (UGX)</th>
                    <th className="px-4 py-3 text-right">Accum Deprec</th>
                    <th className="px-4 py-3 text-right">Net Book Value</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No capital fixed assets found.
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{asset.name}</div>
                          <div className="text-xs text-indigo-600 font-mono font-medium">{asset.assetTag}</div>
                          {asset.serialNumber && (
                            <div className="text-xs text-slate-400">S/N: {asset.serialNumber}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                            {asset.category.code}
                          </span>
                          <div className="text-xs text-slate-500 mt-0.5">{asset.category.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-slate-800">
                            {asset.location ? asset.location.name : "Unassigned"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {asset.custodian ? `${asset.custodian.firstName} ${asset.custodian.lastName}` : "No Custodian"}
                          </div>
                          {asset.transportVehicle && (
                            <div className="text-xs text-amber-700 font-medium">
                              Fleet: {asset.transportVehicle.registrationNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {Number(asset.acquisitionCost).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-amber-700">
                          {Number(asset.accumulatedDepreciation).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">
                          {Number(asset.netBookValue).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              asset.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : asset.status === "FULLY_DEPRECIATED"
                                ? "bg-blue-100 text-blue-800"
                                : asset.status === "DISPOSED"
                                ? "bg-purple-100 text-purple-800"
                                : asset.status === "WRITTEN_OFF"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {asset.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {asset.status !== "DISPOSED" && asset.status !== "WRITTEN_OFF" && (
                            <button
                              onClick={() => {
                                setSelectedAsset(asset);
                                setShowDisposalModal(true);
                              }}
                              className="text-xs font-medium text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded transition"
                            >
                              Dispose / Retire
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEPRECIATION ENGINE */}
      {activeTab === "depreciation" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Periodic Depreciation Runs (Maker-Checker)</h2>
              <button
                onClick={() => setShowNewRunModal(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Schedule New Run
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Run #</th>
                    <th className="px-4 py-3">Fiscal Period</th>
                    <th className="px-4 py-3">Run Date</th>
                    <th className="px-4 py-3 text-right">Assets Count</th>
                    <th className="px-4 py-3 text-right">Total Deprec (UGX)</th>
                    <th className="px-4 py-3">Prepared By</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No periodic depreciation runs created yet.
                      </td>
                    </tr>
                  ) : (
                    runs.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono font-semibold text-indigo-600">{r.runNumber}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{r.fiscalPeriod.name}</td>
                        <td className="px-4 py-3 text-slate-600">{new Date(r.runDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">{r.totalAssetsCount}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {Number(r.totalDepreciationAmount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.createdBy.firstName} {r.createdBy.lastName}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              r.status === "POSTED"
                                ? "bg-emerald-100 text-emerald-800"
                                : r.status === "APPROVED"
                                ? "bg-blue-100 text-blue-800"
                                : r.status === "SUBMITTED"
                                ? "bg-amber-100 text-amber-800"
                                : r.status === "REJECTED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center space-x-2">
                          {r.status === "SUBMITTED" && (
                            <>
                              <button
                                disabled={isPending}
                                onClick={() => handleRunAction(r.id, "APPROVE")}
                                className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                              >
                                Approve (Checker)
                              </button>
                              <button
                                disabled={isPending}
                                onClick={() => {
                                  const reason = prompt("Enter rejection reason:");
                                  if (reason) handleRunAction(r.id, "REJECT", reason);
                                }}
                                className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === "APPROVED" && (
                            <button
                              disabled={isPending}
                              onClick={() => handleRunAction(r.id, "POST_GL")}
                              className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                            >
                              Post to GL
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GL RECONCILIATION & TELEMETRY */}
      {activeTab === "reconcile" && reconciliation && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Fixed Assets vs General Ledger Audit</h2>
                <p className="text-sm text-slate-500">Live comparison of Subledger records vs Control Accounts #1500 & #1600.</p>
              </div>
              <div>
                {reconciliation.isReconciled ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                    Zero Drift Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-rose-100 text-rose-800">
                    <AlertTriangle className="w-4 h-4 mr-1.5 text-rose-600" />
                    Reconciliation Variance
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs font-semibold text-slate-500 uppercase">Gross PPE Cost</div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subledger:</span>
                    <span className="font-semibold text-slate-900">UGX {Number(reconciliation.subledger.totalGrossCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">General Ledger:</span>
                    <span className="font-semibold text-slate-900">UGX {Number(reconciliation.generalLedger.glGrossPPE).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-200 font-bold">
                    <span>Variance:</span>
                    <span className={Number(reconciliation.variance.costVariance) === 0 ? "text-emerald-600" : "text-rose-600"}>
                      UGX {Number(reconciliation.variance.costVariance).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs font-semibold text-slate-500 uppercase">Accumulated Depreciation</div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subledger:</span>
                    <span className="font-semibold text-slate-900">UGX {Number(reconciliation.subledger.totalAccumDeprec).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">General Ledger:</span>
                    <span className="font-semibold text-slate-900">UGX {Number(reconciliation.generalLedger.glAccumDeprec).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-200 font-bold">
                    <span>Variance:</span>
                    <span className={Number(reconciliation.variance.accumVariance) === 0 ? "text-emerald-600" : "text-rose-600"}>
                      UGX {Number(reconciliation.variance.accumVariance).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs font-semibold text-slate-500 uppercase">Net Book Value</div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subledger:</span>
                    <span className="font-semibold text-emerald-700">UGX {Number(reconciliation.subledger.totalNetBookValue).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">General Ledger:</span>
                    <span className="font-semibold text-emerald-700">UGX {Number(reconciliation.generalLedger.glNetBookValue).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-200 font-bold">
                    <span>Variance:</span>
                    <span className={Number(reconciliation.variance.nbvVariance) === 0 ? "text-emerald-600" : "text-rose-600"}>
                      UGX {Number(reconciliation.variance.nbvVariance).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CATEGORIES & LOCATIONS */}
      {activeTab === "categories" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-slate-900">Asset Categories</div>
            <div className="p-4 divide-y divide-slate-100">
              {categories.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{c.name} ({c.code})</div>
                    <div className="text-xs text-slate-500">Method: {c.depreciationMethod} | Useful Life: {c.usefulLifeMonths}m ({Number(c.annualDepreciationRate)}%/yr)</div>
                  </div>
                  <div className="text-xs text-indigo-600 font-medium">
                    GL: #{c.glAssetAccount?.code || "1550"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-slate-900">Campus Locations</div>
            <div className="p-4 divide-y divide-slate-100">
              {locations.length === 0 ? (
                <div className="text-sm text-slate-500 py-4 text-center">No locations configured yet.</div>
              ) : (
                locations.map((l) => (
                  <div key={l.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{l.name}</div>
                      <div className="text-xs text-slate-500">{l.building} {l.roomNumber && `- Room ${l.roomNumber}`}</div>
                    </div>
                    <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {l.code}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: DIRECT CAPITAL ACQUISITION */}
      {showDirectPurchaseModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Direct Capital Asset Acquisition</h3>
              <button onClick={() => setShowDirectPurchaseModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleDirectPurchase} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Asset Name *</label>
                <input
                  type="text"
                  required
                  value={directForm.name}
                  onChange={(e) => setDirectForm({ ...directForm, name: e.target.value })}
                  placeholder="e.g. Dell OptiPlex 7090 Desktop"
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Category *</label>
                  <select
                    value={directForm.categoryId}
                    onChange={(e) => setDirectForm({ ...directForm, categoryId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Paying Treasury Bank/Safe *</label>
                  <select
                    value={directForm.treasuryAccountId}
                    onChange={(e) => setDirectForm({ ...directForm, treasuryAccountId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    {treasuryAccounts.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} (UGX {Number(t.currentBalance).toLocaleString()})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Acquisition Cost (UGX) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={directForm.acquisitionCost}
                    onChange={(e) => setDirectForm({ ...directForm, acquisitionCost: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-semibold text-indigo-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Salvage Value (UGX)</label>
                  <input
                    type="number"
                    min="0"
                    value={directForm.salvageValue}
                    onChange={(e) => setDirectForm({ ...directForm, salvageValue: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={directForm.purchaseDate}
                    onChange={(e) => setDirectForm({ ...directForm, purchaseDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Capitalization Date *</label>
                  <input
                    type="date"
                    required
                    value={directForm.capitalizationDate}
                    onChange={(e) => setDirectForm({ ...directForm, capitalizationDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Serial Number</label>
                <input
                  type="text"
                  value={directForm.serialNumber}
                  onChange={(e) => setDirectForm({ ...directForm, serialNumber: e.target.value })}
                  placeholder="Manufacturer Serial No."
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDirectPurchaseModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {isPending ? "Capitalizing..." : "Capitalize & Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: OPENING BALANCE BOOTSTRAP */}
      {showBootstrapModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Import Opening Asset Balance</h3>
              <button onClick={() => setShowBootstrapModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleBootstrapAsset} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Asset Name *</label>
                <input
                  type="text"
                  required
                  value={bootstrapForm.name}
                  onChange={(e) => setBootstrapForm({ ...bootstrapForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Category *</label>
                  <select
                    value={bootstrapForm.categoryId}
                    onChange={(e) => setBootstrapForm({ ...bootstrapForm, categoryId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Custom Tag (Optional)</label>
                  <input
                    type="text"
                    value={bootstrapForm.assetTag}
                    onChange={(e) => setBootstrapForm({ ...bootstrapForm, assetTag: e.target.value })}
                    placeholder="e.g. AST-2024-0012"
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Historical Gross Cost (UGX) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={bootstrapForm.acquisitionCost}
                    onChange={(e) => setBootstrapForm({ ...bootstrapForm, acquisitionCost: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Accumulated Deprec (UGX) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={bootstrapForm.accumulatedDepreciation}
                    onChange={(e) => setBootstrapForm({ ...bootstrapForm, accumulatedDepreciation: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-semibold text-amber-700"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBootstrapModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {isPending ? "Importing..." : "Import Opening Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ASSET DISPOSAL */}
      {showDisposalModal && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Dispose / Retire Capital Asset</h3>
              <button onClick={() => setShowDisposalModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
              <div><span className="font-semibold text-slate-700">Asset:</span> {selectedAsset.name} ({selectedAsset.assetTag})</div>
              <div><span className="font-semibold text-slate-700">Cost:</span> UGX {Number(selectedAsset.acquisitionCost).toLocaleString()} | <span className="font-semibold text-slate-700">Accum:</span> UGX {Number(selectedAsset.accumulatedDepreciation).toLocaleString()}</div>
              <div><span className="font-semibold text-slate-700">Current Net Book Value:</span> <span className="font-bold text-emerald-700">UGX {Number(selectedAsset.netBookValue).toLocaleString()}</span></div>
            </div>

            <form onSubmit={handleDisposal} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Disposal Type *</label>
                  <select
                    value={disposalForm.disposalType}
                    onChange={(e) => setDisposalForm({ ...disposalForm, disposalType: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="SALE">SALE (With Proceeds)</option>
                    <option value="SCRAP">SCRAP (Zero/Nominal)</option>
                    <option value="INSURANCE_LOSS">INSURANCE LOSS</option>
                    <option value="WRITE_OFF">TOTAL WRITE-OFF</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Disposal Date *</label>
                  <input
                    type="date"
                    required
                    value={disposalForm.disposalDate}
                    onChange={(e) => setDisposalForm({ ...disposalForm, disposalDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              {disposalForm.disposalType === "SALE" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Proceeds (UGX) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={disposalForm.disposalProceeds}
                      onChange={(e) => setDisposalForm({ ...disposalForm, disposalProceeds: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-semibold text-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Receiving Bank/Safe *</label>
                    <select
                      value={disposalForm.treasuryAccountId}
                      onChange={(e) => setDisposalForm({ ...disposalForm, treasuryAccountId: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                    >
                      {treasuryAccounts.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">Reason for Retirement / Disposal *</label>
                <textarea
                  required
                  value={disposalForm.reason}
                  onChange={(e) => setDisposalForm({ ...disposalForm, reason: e.target.value })}
                  placeholder="e.g. Obsolete equipment replaced by new ICT laboratory desktops"
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDisposalModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700"
                >
                  {isPending ? "Retiring..." : "Retire & Post GL"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: NEW DEPRECIATION RUN */}
      {showNewRunModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Schedule Periodic Depreciation</h3>
              <button onClick={() => setShowNewRunModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateRun} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Target Fiscal Period *</label>
                <select
                  value={runPeriodId}
                  onChange={(e) => setRunPeriodId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  {fiscalPeriods.filter(p => p.status === "OPEN").map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({new Date(p.startDate).toLocaleDateString()} - {new Date(p.endDate).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Notes / Audit Remarks</label>
                <textarea
                  value={runNotes}
                  onChange={(e) => setRunNotes(e.target.value)}
                  placeholder="e.g. Term 1 Monthly depreciation run for campus ICT, fleet and building assets."
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewRunModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {isPending ? "Calculating..." : "Generate Run (Submit)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
