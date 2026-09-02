"use client";

import React, { useState } from "react";
import {
  Building2,
  Vault,
  Wallet,
  Coins,
  ArrowRightLeft,
  FileSpreadsheet,
  CheckCircle2,
  Plus,
  RefreshCw,
  AlertTriangle,
  FileCheck,
  Landmark,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccountDTO {
  id: string;
  code: string;
  name: string;
  accountType: string;
  bankName: string | null;
  accountNumber: string | null;
  currency: string;
  openingBalance: string;
  currentBalance: string;
  isDefaultFeeCollection: boolean;
  isDefaultOperations: boolean;
  isDefaultPettyCash: boolean;
  isActive: boolean;
  custodian: string | null;
}

interface SummaryDTO {
  totalLiquidity: string;
  commercialBanks: string;
  cashSafes: string;
  cashierTills: string;
  mobileMoneyFloats: string;
  pettyCashFloats: string;
}

interface ShiftDTO {
  id: string;
  cashierName: string;
  tillName: string;
  openedAt: string;
  closedAt: string | null;
  openingFloat: string;
  expectedClosingBalance: string | null;
  actualCashCounted: string | null;
  cashVariance: string | null;
  status: string;
  varianceNotes: string | null;
  supervisorName: string | null;
}

interface TransferDTO {
  id: string;
  transferNumber: string;
  fromAccountName: string;
  toAccountName: string;
  amount: string;
  transferMethod: string;
  depositSlipNumber: string | null;
  status: string;
  initiatedByName: string;
  approvedByName: string | null;
  createdAt: string;
}

interface ImprestDTO {
  id: string;
  name: string;
  accountName: string;
  accountBalance: string;
  floatCeiling: string;
  replenishmentThreshold: string;
  custodianName: string;
  departmentName: string | null;
}

interface StatementDTO {
  id: string;
  accountName: string;
  statementIdentifier: string;
  startDate: string;
  endDate: string;
  closingBalance: string;
  linesCount: number;
  unreconciledCount: number;
}

interface ReconciliationDTO {
  id: string;
  reconciliationNumber: string;
  accountName: string;
  statementIdentifier: string;
  statementClosingBalance: string;
  cashbookClosingBalance: string;
  adjustedBankBalance: string;
  adjustedCashbookBalance: string;
  variance: string;
  status: string;
  certifiedByName: string | null;
  createdAt: string;
}

interface Props {
  initialAccounts: AccountDTO[];
  initialSummary: SummaryDTO;
  initialShifts: ShiftDTO[];
  initialTransfers: TransferDTO[];
  initialImprests: ImprestDTO[];
  initialStatements: StatementDTO[];
  initialReconciliations: ReconciliationDTO[];
}

export default function TreasuryDashboardClient({
  initialAccounts,
  initialSummary,
  initialShifts,
  initialTransfers,
  initialImprests,
  initialStatements,
  initialReconciliations,
}: Props) {
  const [activeTab, setActiveTab] = useState<"accounts" | "shifts" | "transfers" | "petty" | "reconcile">("accounts");
  const [accounts, setAccounts] = useState<AccountDTO[]>(initialAccounts);
  const [summary] = useState<SummaryDTO>(initialSummary);
  const [shifts] = useState<ShiftDTO[]>(initialShifts);
  const [transfers] = useState<TransferDTO[]>(initialTransfers);
  const [imprests] = useState<ImprestDTO[]>(initialImprests);
  const [statements] = useState<StatementDTO[]>(initialStatements);
  const [reconciliations] = useState<ReconciliationDTO[]>(initialReconciliations);

  // Modal states
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [newAccountCode, setNewAccountCode] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("COMMERCIAL_BANK");
  const [newAccountOpeningBal, setNewAccountOpeningBal] = useState("0");
  const [newAccountBankName, setNewAccountBankName] = useState("");
  const [newAccountNo, setNewAccountNo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const formatUGX = (amtStr: string) => {
    const num = parseFloat(amtStr);
    return isNaN(num) ? "0 UGX" : `${num.toLocaleString("en-UG")} UGX`;
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/treasury/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newAccountCode,
          name: newAccountName,
          accountType: newAccountType,
          openingBalance: parseFloat(newAccountOpeningBal) || 0,
          bankName: newAccountBankName || undefined,
          accountNumber: newAccountNo || undefined,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }
      const data = await res.json();
      setAccounts([...accounts, {
        ...data.account,
        openingBalance: data.account.openingBalance.toString(),
        currentBalance: data.account.currentBalance.toString(),
        custodian: null,
      }]);
      setShowNewAccountModal(false);
      setStatusMessage({ type: "success", text: `Treasury account ${data.account.name} successfully created.` });
    } catch (err: unknown) {
      setStatusMessage({ type: "error", text: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Landmark className="text-emerald-600" size={28} />
            School Treasury, Multi-Account Cashbook &amp; Bank Reconciliation
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Institutional cashbook authority, cashier till balancing, two-legged transfers, petty cash imprest, and statutory Bank Reconciliation Statement (BRS).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowNewAccountModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
          >
            <Plus size={16} /> New Treasury Account
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {statusMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {statusMessage.text}
        </div>
      )}

      {/* Real-time Liquidity Position Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between opacity-80 text-xs uppercase font-semibold">
            <span>Total Liquidity</span>
            <Coins size={16} />
          </div>
          <div className="mt-2 text-xl font-bold font-mono">{formatUGX(summary.totalLiquidity)}</div>
          <div className="mt-1 text-xs opacity-70">Across all banks, safes &amp; tills</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs uppercase font-semibold">
            <span>Commercial Banks</span>
            <Building2 size={16} className="text-blue-600" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-slate-900">{formatUGX(summary.commercialBanks)}</div>
          <div className="mt-1 text-xs text-slate-500">School collection &amp; ops</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs uppercase font-semibold">
            <span>Main Vault Safe</span>
            <Vault size={16} className="text-amber-600" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-slate-900">{formatUGX(summary.cashSafes)}</div>
          <div className="mt-1 text-xs text-slate-500">Bursar physical cash</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs uppercase font-semibold">
            <span>Cashier Tills</span>
            <Wallet size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-slate-900">{formatUGX(summary.cashierTills)}</div>
          <div className="mt-1 text-xs text-slate-500">Counter drawers active</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs uppercase font-semibold">
            <span>Petty Cash Float</span>
            <Coins size={16} className="text-purple-600" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-slate-900">{formatUGX(summary.pettyCashFloats)}</div>
          <div className="mt-1 text-xs text-slate-500">Department imprests</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("accounts")}
          className={`pb-3 border-b-2 flex items-center gap-2 ${
            activeTab === "accounts"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Layers size={16} /> Accounts &amp; Cashbook ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab("shifts")}
          className={`pb-3 border-b-2 flex items-center gap-2 ${
            activeTab === "shifts"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Wallet size={16} /> Cashier Shifts &amp; Banking ({shifts.length})
        </button>
        <button
          onClick={() => setActiveTab("transfers")}
          className={`pb-3 border-b-2 flex items-center gap-2 ${
            activeTab === "transfers"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ArrowRightLeft size={16} /> Transfers &amp; Banking Deposits ({transfers.length})
        </button>
        <button
          onClick={() => setActiveTab("petty")}
          className={`pb-3 border-b-2 flex items-center gap-2 ${
            activeTab === "petty"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Coins size={16} /> Petty Cash Imprest ({imprests.length})
        </button>
        <button
          onClick={() => setActiveTab("reconcile")}
          className={`pb-3 border-b-2 flex items-center gap-2 ${
            activeTab === "reconcile"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileSpreadsheet size={16} /> Bank Reconciliation &amp; BRS ({reconciliations.length})
        </button>
      </div>

      {/* Tab 1: Accounts & Cashbook */}
      {activeTab === "accounts" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Registered Treasury Repositories</h2>
            <span className="text-xs text-slate-500">Atomic balance ledger verified</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Account Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Bank Details</th>
                  <th className="px-4 py-3 text-right">Current Liquid Balance</th>
                  <th className="px-4 py-3 text-center">Designations</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{acc.code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{acc.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                        {acc.accountType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {acc.bankName ? `${acc.bankName} (${acc.accountNumber || "N/A"})` : "Internal / Cash"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-base">
                      {formatUGX(acc.currentBalance)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {acc.isDefaultFeeCollection && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Fees
                          </span>
                        )}
                        {acc.isDefaultOperations && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            Ops
                          </span>
                        )}
                        {acc.isDefaultPettyCash && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                            Petty
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 size={14} /> Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Shifts & Banking */}
      {activeTab === "shifts" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Cashier Drawer Shift Sessions &amp; Till Counts</h2>
            <span className="text-xs text-slate-500">Zero cash leakage governance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">Till Account</th>
                  <th className="px-4 py-3">Opened At</th>
                  <th className="px-4 py-3 text-right">Opening Float</th>
                  <th className="px-4 py-3 text-right">Expected</th>
                  <th className="px-4 py-3 text-right">Counted</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      No shift sessions recorded yet.
                    </td>
                  </tr>
                ) : (
                  shifts.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-semibold text-slate-900">{s.cashierName}</td>
                      <td className="px-4 py-3 text-xs">{s.tillName}</td>
                      <td className="px-4 py-3 text-xs">{new Date(s.openedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatUGX(s.openingFloat)}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {s.expectedClosingBalance ? formatUGX(s.expectedClosingBalance) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {s.actualCashCounted ? formatUGX(s.actualCashCounted) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {s.cashVariance ? (
                          <span
                            className={
                              parseFloat(s.cashVariance) < 0
                                ? "text-rose-600 font-bold"
                                : parseFloat(s.cashVariance) > 0
                                ? "text-emerald-600 font-bold"
                                : "text-slate-600"
                            }
                          >
                            {formatUGX(s.cashVariance)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            s.status === "OPEN"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Transfers & Banking */}
      {activeTab === "transfers" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Inter-Account Transfers &amp; Cash-in-Transit</h2>
            <span className="text-xs text-slate-500">Atomic two-legged transfers</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Transfer #</th>
                  <th className="px-4 py-3">From Account</th>
                  <th className="px-4 py-3">To Account</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Slip / Escort</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No treasury transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{t.transferNumber}</td>
                      <td className="px-4 py-3 text-slate-900">{t.fromAccountName}</td>
                      <td className="px-4 py-3 text-slate-900">{t.toAccountName}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {formatUGX(t.amount)}
                      </td>
                      <td className="px-4 py-3 text-xs">{t.transferMethod}</td>
                      <td className="px-4 py-3 text-xs font-mono">{t.depositSlipNumber || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            t.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.status === "IN_TRANSIT"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Petty Cash */}
      {activeTab === "petty" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Petty Cash Imprest Floats &amp; Vouchers</h2>
            <span className="text-xs text-slate-500">Autonomous float replenishment</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Float Name</th>
                  <th className="px-4 py-3">Custodian</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-right">Available Cash</th>
                  <th className="px-4 py-3 text-right">Ceiling</th>
                  <th className="px-4 py-3 text-right">Threshold</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {imprests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No petty cash imprests configured yet.
                    </td>
                  </tr>
                ) : (
                  imprests.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-semibold text-slate-900">{i.name}</td>
                      <td className="px-4 py-3">{i.custodianName}</td>
                      <td className="px-4 py-3 text-xs">{i.departmentName || "General"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                        {formatUGX(i.accountBalance)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatUGX(i.floatCeiling)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatUGX(i.replenishmentThreshold)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Bank Reconciliation */}
      {activeTab === "reconcile" && (
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Certified Statutory Bank Reconciliation Statements (BRS)</h2>
              <span className="text-xs text-slate-500">Zero variance proof</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">BRS #</th>
                    <th className="px-4 py-3">Bank Account</th>
                    <th className="px-4 py-3">Statement Ref</th>
                    <th className="px-4 py-3 text-right">Statement Balance</th>
                    <th className="px-4 py-3 text-right">Cashbook Balance</th>
                    <th className="px-4 py-3 text-right">Adjusted Balance</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                    <th className="px-4 py-3 text-center">Certification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reconciliations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No bank reconciliation statements locked yet.
                      </td>
                    </tr>
                  ) : (
                    reconciliations.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{r.reconciliationNumber}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{r.accountName}</td>
                        <td className="px-4 py-3 text-xs font-mono">{r.statementIdentifier}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatUGX(r.statementClosingBalance)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatUGX(r.cashbookClosingBalance)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {formatUGX(r.adjustedBankBalance)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                          {formatUGX(r.variance)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                            <FileCheck size={14} /> LOCKED
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Uploaded Statements */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Imported Electronic Bank Statements</h2>
              <span className="text-xs text-slate-500">SHA-256 deduplicated</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Statement Identifier</th>
                    <th className="px-4 py-3">Bank Account</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3 text-right">Closing Balance</th>
                    <th className="px-4 py-3 text-center">Total Lines</th>
                    <th className="px-4 py-3 text-center">Unreconciled Lines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No bank statements imported yet.
                      </td>
                    </tr>
                  ) : (
                    statements.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{s.statementIdentifier}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{s.accountName}</td>
                        <td className="px-4 py-3 text-xs">
                          {new Date(s.startDate).toLocaleDateString()} – {new Date(s.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {formatUGX(s.closingBalance)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{s.linesCount}</td>
                        <td className="px-4 py-3 text-center font-mono">
                          <span
                            className={
                              s.unreconciledCount > 0 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"
                            }
                          >
                            {s.unreconciledCount}
                          </span>
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

      {/* New Account Modal */}
      {showNewAccountModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create New Treasury Account</h3>
            <form onSubmit={handleCreateAccount} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Account Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STANBIC-MAIN"
                  value={newAccountCode}
                  onChange={(e) => setNewAccountCode(e.target.value.toUpperCase())}
                  className="w-full border rounded-lg px-3 py-2 text-sm uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stanbic School Fees Collection"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Account Type</label>
                <select
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="COMMERCIAL_BANK">Commercial Bank Account</option>
                  <option value="CASH_OFFICE_SAFE">Cash Office Main Vault Safe</option>
                  <option value="CASHIER_TILL">Cashier Counter Till Drawer</option>
                  <option value="MOBILE_MONEY_FLOAT">Mobile Money Merchant Float</option>
                  <option value="PETTY_CASH_FLOAT">Petty Cash Imprest Float</option>
                </select>
              </div>
              {newAccountType === "COMMERCIAL_BANK" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Stanbic Bank"
                      value={newAccountBankName}
                      onChange={(e) => setNewAccountBankName(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 9030012345"
                      value={newAccountNo}
                      onChange={(e) => setNewAccountNo(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-slate-700 font-medium mb-1">Initial Opening Balance (UGX)</label>
                <input
                  type="number"
                  min="0"
                  value={newAccountOpeningBal}
                  onChange={(e) => setNewAccountOpeningBal(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewAccountModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmitting ? "Creating..." : "Create Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
