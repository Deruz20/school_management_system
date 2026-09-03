"use client";

import { useState, useTransition } from "react";
import {
  BookOpen,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Lock,
  Unlock
} from "lucide-react";

export interface AccountRow {
  id: string;
  code: string;
  name: string;
  accountType: string;
  normalBalance: string;
  controlRole: string;
  isHeader: boolean;
  parentId?: string | null;
  debitBalance?: string | number;
  creditBalance?: string | number;
}

export interface JournalLineRow {
  id: string;
  accountId: string;
  lineNumber: number;
  description?: string | null;
  debit: string | number;
  credit: string | number;
  account: { code: string; name: string };
}

export interface JournalRow {
  id: string;
  journalNumber: string;
  journalType: string;
  status: string;
  entryDate: string;
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
  isReversal?: boolean;
  lines: JournalLineRow[];
}

export interface FiscalPeriodRow {
  id: string;
  periodNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface SubledgerReconciliationDetail {
  glBalance: string | number;
  subledgerTotal: string | number;
  drift: string | number;
  isBalanced: boolean;
}

export interface ReconciliationData {
  isFullyBalanced: boolean;
  ar: SubledgerReconciliationDetail;
  treasury: SubledgerReconciliationDetail;
  inventory: SubledgerReconciliationDetail;
}

export interface TrialBalanceReport {
  asOfDate: string | Date;
  totalDebit: string | number;
  totalCredit: string | number;
  variance: string | number;
  isBalanced: boolean;
  rows: Array<{
    id: string;
    code: string;
    name: string;
    isHeader: boolean;
    debitBalance: string | number;
    creditBalance: string | number;
  }>;
}

export interface IncomeStatementReport {
  period: { startDate: string | Date; endDate: string | Date };
  grossRevenue: string | number;
  directCosts: {
    total: string | number;
    items: Array<{ code: string; name: string; amount: string | number }>;
  };
  grossEducationalMargin: string | number;
  operatingExpenses: {
    total: string | number;
    items: Array<{ code: string; name: string; amount: string | number }>;
  };
  netComprehensiveSurplus: string | number;
}

export interface BalanceSheetReport {
  asOfDate: string | Date;
  isBalanced: boolean;
  assets: {
    currentAssets: Array<{ code: string; name: string; amount: string | number }>;
    totalAssets: string | number;
  };
  liabilities: {
    currentLiabilities: Array<{ code: string; name: string; amount: string | number }>;
    totalLiabilities: string | number;
  };
  equity: {
    items: Array<{ code: string; name: string; amount: string | number }>;
    currentPeriodNetSurplus: string | number;
    totalEquity: string | number;
  };
  totalLiabilitiesAndEquity: string | number;
}

function toNum(v: string | number | undefined | null): number {
  if (v === undefined || v === null) return 0;
  return typeof v === "number" ? v : (parseFloat(v) || 0);
}

export default function GeneralLedgerClient({
  initialAccounts,
  initialJournals,
  initialPeriods,
  initialReconciliation
}: {
  initialAccounts: AccountRow[];
  initialJournals: JournalRow[];
  initialPeriods: FiscalPeriodRow[];
  initialReconciliation: ReconciliationData;
}) {
  const [activeTab, setActiveTab] = useState<"accounts" | "journals" | "statements" | "periods" | "reconcile">("accounts");
  const [statementType, setStatementType] = useState<"tb" | "is" | "bs">("tb");

  const [accounts] = useState<AccountRow[]>(initialAccounts || []);
  const [journals, setJournals] = useState<JournalRow[]>(initialJournals || []);
  const [periods, setPeriods] = useState<FiscalPeriodRow[]>(initialPeriods || []);
  const [reconciliation, setReconciliation] = useState<ReconciliationData>(initialReconciliation);

  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Statement report data state
  const [tbReport, setTbReport] = useState<TrialBalanceReport | null>(null);
  const [isReport, setIsReport] = useState<IncomeStatementReport | null>(null);
  const [bsReport, setBsReport] = useState<BalanceSheetReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Manual Journal Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [journalDate, setJournalDate] = useState(new Date().toISOString().slice(0, 10));
  const [journalDesc, setJournalDesc] = useState("");
  const [journalRef, setJournalRef] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [journalLines, setJournalLines] = useState<Array<{ accountId: string; debit: string; credit: string; description: string }>>([
    { accountId: "", debit: "", credit: "", description: "" },
    { accountId: "", debit: "", credit: "", description: "" }
  ]);

  // Reverse Modal State
  const [reversingJournalId, setReversingJournalId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  const leafAccounts = accounts.filter(a => !a.isHeader);

  const handleAddLine = () => {
    setJournalLines([...journalLines, { accountId: "", debit: "", credit: "", description: "" }]);
  };

  const handleLineChange = (index: number, field: string, value: string) => {
    const updated = [...journalLines];
    updated[index] = { ...updated[index], [field]: value };
    setJournalLines(updated);
  };

  const totalDebits = journalLines.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCredits = journalLines.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const drift = Math.abs(totalDebits - totalCredits);
  const isJournalBalanced = totalDebits > 0 && drift < 0.01;

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDraft && !isJournalBalanced) {
      setStatusMessage({ type: "error", text: "Journal is unbalanced. Total Debits must equal Total Credits." });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/finance/gl/journals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryDate: journalDate,
            description: journalDesc,
            referenceNumber: journalRef,
            isDraft,
            lines: journalLines.map(l => ({
              accountId: l.accountId,
              debit: parseFloat(l.debit) || 0,
              credit: parseFloat(l.credit) || 0,
              description: l.description
            }))
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText);
        }

        const data = await res.json();
        setJournals([data.journal, ...journals]);
        setShowCreateModal(false);
        setJournalDesc("");
        setJournalRef("");
        setJournalLines([
          { accountId: "", debit: "", credit: "", description: "" },
          { accountId: "", debit: "", credit: "", description: "" }
        ]);
        setStatusMessage({ type: "success", text: `Journal ${data.journal.journalNumber} created successfully.` });
      } catch (err: unknown) {
        setStatusMessage({ type: "error", text: (err as Error).message });
      }
    });
  };

  const handleReverseJournal = async () => {
    if (!reversingJournalId) return;
    if (reversalReason.trim().length < 10) {
      setStatusMessage({ type: "error", text: "Reversal reason must be at least 10 characters." });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/finance/gl/journals/${reversingJournalId}/reverse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reversalReason })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText);
        }

        const data = await res.json();
        setJournals(journals.map(j => (j.id === reversingJournalId ? { ...j, status: "REVERSED" } : j)));
        setJournals(prev => [data.reversalJournal, ...prev]);
        setReversingJournalId(null);
        setReversalReason("");
        setStatusMessage({ type: "success", text: `Compensating reversal journal ${data.reversalJournal.journalNumber} posted.` });
      } catch (err: unknown) {
        setStatusMessage({ type: "error", text: (err as Error).message });
      }
    });
  };

  const handlePeriodAction = async (periodId: string, action: "CLOSE_PERIOD" | "LOCK_PERIOD" | "REOPEN_PERIOD") => {
    let reason: string | undefined;
    if (action === "REOPEN_PERIOD") {
      const input = prompt("Enter mandatory audit reason for reopening this period:");
      if (!input || input.trim().length < 10) {
        alert("Reopening reason must be at least 10 characters.");
        return;
      }
      reason = input.trim();
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/finance/gl/periods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, periodId, reason })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText);
        }

        const data = await res.json();
        setPeriods(periods.map(p => (p.id === periodId ? data.period : p)));
        setStatusMessage({ type: "success", text: `Period status updated to ${data.period.status}.` });
      } catch (err: unknown) {
        setStatusMessage({ type: "error", text: (err as Error).message });
      }
    });
  };

  const loadStatement = async (type: "tb" | "is" | "bs") => {
    setLoadingReport(true);
    setStatementType(type);
    try {
      if (type === "tb") {
        const res = await fetch("/api/finance/gl/reports/trial-balance");
        const data = await res.json();
        setTbReport(data.report);
      } else if (type === "is") {
        const res = await fetch("/api/finance/gl/reports/income-statement");
        const data = await res.json();
        setIsReport(data.report);
      } else if (type === "bs") {
        const res = await fetch("/api/finance/gl/reports/balance-sheet");
        const data = await res.json();
        setBsReport(data.report);
      }
    } catch (err: unknown) {
      setStatusMessage({ type: "error", text: (err as Error).message });
    } finally {
      setLoadingReport(false);
    }
  };

  const handleTriggerReconcile = async () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/finance/gl/reconcile");
        const data = await res.json();
        setReconciliation(data.reconciliation);
        setStatusMessage({ type: "success", text: "Subledger reconciliation refreshed." });
      } catch (err: unknown) {
        setStatusMessage({ type: "error", text: (err as Error).message });
      }
    });
  };

  const handleBootstrapOpening = async () => {
    if (!confirm("Bootstrap opening balances snapshot from current active subledgers into Opening Balance Equity (#3500)?")) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/finance/gl/bootstrap", { method: "POST" });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err);
        }
        const data = await res.json();
        setStatusMessage({
          type: "success",
          text: data.isReplay
            ? `Opening balance journal already exists (${data.journal.journalNumber}).`
            : `Opening balance journal ${data.journal.journalNumber} created with zero drift.`
        });
        handleTriggerReconcile();
      } catch (err: unknown) {
        setStatusMessage({ type: "error", text: (err as Error).message });
      }
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
              <BookOpen size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">General Ledger & Double-Entry Accounting</h1>
              <p className="text-xs text-slate-500">
                Authoritative Double-Entry Accounting Synthesis, Chart of Accounts & Subledger Governance
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
          >
            <Plus size={16} /> New Journal Voucher
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 bg-slate-50 p-1.5 rounded-xl">
        <button
          onClick={() => setActiveTab("accounts")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "accounts" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Chart of Accounts ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab("journals")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "journals" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Journal Entries ({journals.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("statements");
            if (!tbReport) loadStatement("tb");
          }}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "statements" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Financial Statements
        </button>
        <button
          onClick={() => setActiveTab("periods")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "periods" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Fiscal Periods
        </button>
        <button
          onClick={() => setActiveTab("reconcile")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === "reconcile" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Scale size={16} /> Subledger Drift & Reconciliation
          {reconciliation?.isFullyBalanced ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>
      </div>

      {/* TAB 1: CHART OF ACCOUNTS */}
      {activeTab === "accounts" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Master Chart of Accounts (COA)</h2>
            <span className="text-xs text-slate-500">Standard Ugandan School Hierarchy</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Normal Balance</th>
                  <th className="py-3 px-4">Control Role</th>
                  <th className="py-3 px-4">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map(acc => (
                  <tr
                    key={acc.id}
                    className={`hover:bg-slate-50 ${acc.isHeader ? "bg-slate-50/50 font-bold text-slate-900" : "text-slate-700"}`}
                  >
                    <td className="py-2.5 px-4 font-mono font-bold text-emerald-800">{acc.code}</td>
                    <td className="py-2.5 px-4" style={{ paddingLeft: acc.isHeader ? "1rem" : "2rem" }}>
                      {acc.name}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {acc.accountType}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono">{acc.normalBalance}</td>
                    <td className="py-2.5 px-4">
                      {acc.controlRole !== "NONE" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {acc.controlRole}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {acc.isHeader ? (
                        <span className="text-amber-700 font-semibold">Header</span>
                      ) : (
                        <span className="text-slate-500">Postable Leaf</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: JOURNAL VOUCHERS */}
      {activeTab === "journals" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Double-Entry Journal Vouchers</h2>
              <span className="text-xs text-slate-500">Immutable Audit Trail</span>
            </div>

            <div className="divide-y divide-slate-100">
              {journals.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No journal vouchers posted yet.</div>
              ) : (
                journals.map(j => {
                  const debitSum = j.lines.reduce((s, l) => s + toNum(l.debit), 0);
                  const creditSum = j.lines.reduce((s, l) => s + toNum(l.credit), 0);

                  return (
                    <div key={j.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-emerald-800 text-sm">{j.journalNumber}</span>
                          <span className="text-xs text-slate-500">{new Date(j.entryDate).toLocaleDateString()}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {j.journalType}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              j.status === "POSTED"
                                ? "bg-emerald-100 text-emerald-800"
                                : j.status === "DRAFT"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {j.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-xs font-mono">
                            <span className="text-slate-500">Total:</span>{" "}
                            <span className="font-bold text-slate-900">UGX {debitSum.toLocaleString()}</span>
                          </div>
                          {j.status === "POSTED" && j.journalType !== "REVERSAL" && (
                            <button
                              onClick={() => setReversingJournalId(j.id)}
                              className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 font-semibold"
                            >
                              <RotateCcw size={12} /> Reverse
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 mb-3">{j.description}</p>

                      {/* Journal Lines Table */}
                      <div className="bg-slate-50 rounded-lg p-2 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="text-slate-400 font-semibold border-b border-slate-200/60 pb-1">
                            <tr>
                              <th className="py-1 px-2 text-left">Account</th>
                              <th className="py-1 px-2 text-left">Description</th>
                              <th className="py-1 px-2 text-right">Debit (UGX)</th>
                              <th className="py-1 px-2 text-right">Credit (UGX)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/40 font-mono">
                            {j.lines.map(line => (
                              <tr key={line.id} className="hover:bg-slate-100/50">
                                <td className="py-1 px-2 font-semibold text-slate-700">
                                  {line.account.code} - {line.account.name}
                                </td>
                                <td className="py-1 px-2 text-slate-500 font-sans">{line.description || "—"}</td>
                                <td className="py-1 px-2 text-right font-bold text-emerald-800">
                                  {toNum(line.debit) > 0 ? toNum(line.debit).toLocaleString() : "—"}
                                </td>
                                <td className="py-1 px-2 text-right font-bold text-slate-800">
                                  {toNum(line.credit) > 0 ? toNum(line.credit).toLocaleString() : "—"}
                                </td>
                              </tr>
                            ))}
                            <tr className="font-bold bg-slate-200/30">
                              <td colSpan={2} className="py-1 px-2 text-slate-600 text-right uppercase text-[10px]">
                                Balance Check
                              </td>
                              <td className="py-1 px-2 text-right text-emerald-800">{debitSum.toLocaleString()}</td>
                              <td className="py-1 px-2 text-right text-slate-800">{creditSum.toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FINANCIAL STATEMENTS */}
      {activeTab === "statements" && (
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => loadStatement("tb")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md ${
                statementType === "tb" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Trial Balance (TB)
            </button>
            <button
              onClick={() => loadStatement("is")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md ${
                statementType === "is" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Statement of Comprehensive Income (P&L)
            </button>
            <button
              onClick={() => loadStatement("bs")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md ${
                statementType === "bs" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Statement of Financial Position (Balance Sheet)
            </button>
          </div>

          {loadingReport ? (
            <div className="p-8 text-center text-xs text-slate-500">Generating financial statement...</div>
          ) : statementType === "tb" && tbReport ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Trial Balance</h3>
                  <p className="text-xs text-slate-500">As of {new Date(tbReport.asOfDate).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {tbReport.isBalanced ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
                      <CheckCircle2 size={14} /> Zero Variance Balanced
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-800 text-xs font-bold rounded-full border border-rose-200">
                      <AlertTriangle size={14} /> Variance: UGX {toNum(tbReport.variance).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <table className="w-full text-xs font-mono">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3 text-left">Code</th>
                    <th className="py-2 px-3 text-left">Account</th>
                    <th className="py-2 px-3 text-right">Debit Balance (UGX)</th>
                    <th className="py-2 px-3 text-right">Credit Balance (UGX)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tbReport.rows
                    .filter((r) => !r.isHeader && (toNum(r.debitBalance) > 0 || toNum(r.creditBalance) > 0))
                    .map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-emerald-800">{row.code}</td>
                        <td className="py-2 px-3 font-sans">{row.name}</td>
                        <td className="py-2 px-3 text-right">
                          {toNum(row.debitBalance) > 0 ? toNum(row.debitBalance).toLocaleString() : "—"}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {toNum(row.creditBalance) > 0 ? toNum(row.creditBalance).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  <tr className="bg-slate-100 font-bold text-sm">
                    <td colSpan={2} className="py-2 px-3 text-slate-700 uppercase">
                      Total
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-900">
                      {toNum(tbReport.totalDebit).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-900">
                      {toNum(tbReport.totalCredit).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : statementType === "is" && isReport ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Statement of Comprehensive Income (P&L)</h3>
                <p className="text-xs text-slate-500">For the period ended {new Date(isReport.period.endDate).toLocaleDateString()}</p>
              </div>

              <div className="space-y-4 text-xs font-mono">
                <div>
                  <div className="font-bold text-slate-900 border-b pb-1 mb-2 font-sans flex justify-between">
                    <span>1. Operating Revenues</span>
                    <span>UGX {toNum(isReport.grossRevenue).toLocaleString()}</span>
                  </div>
                  {isReport.directCosts.items.length === 0 && <div className="text-slate-400 pl-4">No revenues</div>}
                </div>

                <div>
                  <div className="font-bold text-slate-900 border-b pb-1 mb-2 font-sans flex justify-between">
                    <span>2. Direct Costs of Education</span>
                    <span>UGX {toNum(isReport.directCosts.total).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-emerald-50 p-3 rounded-lg flex justify-between font-bold text-emerald-900 text-sm">
                  <span>Gross Educational Margin:</span>
                  <span>UGX {toNum(isReport.grossEducationalMargin).toLocaleString()}</span>
                </div>

                <div>
                  <div className="font-bold text-slate-900 border-b pb-1 mb-2 font-sans flex justify-between">
                    <span>3. Operational & Administrative Expenses</span>
                    <span>UGX {toNum(isReport.operatingExpenses.total).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-slate-900 text-white p-4 rounded-lg flex justify-between font-bold text-base">
                  <span>Net Comprehensive Surplus / (Deficit):</span>
                  <span>UGX {toNum(isReport.netComprehensiveSurplus).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : statementType === "bs" && bsReport ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Statement of Financial Position (Balance Sheet)</h3>
                  <p className="text-xs text-slate-500">As of {new Date(bsReport.asOfDate).toLocaleDateString()}</p>
                </div>
                {bsReport.isBalanced && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
                    <CheckCircle2 size={14} /> Assets ≡ Liabilities + Equity
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                {/* Left: Assets */}
                <div className="space-y-4">
                  <div className="font-bold text-slate-900 border-b pb-1 font-sans text-sm">Assets</div>
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase font-sans text-[10px] font-bold">Current Assets</span>
                    {bsReport.assets.currentAssets.map((ca) => (
                      <div key={ca.code} className="flex justify-between py-1 border-b border-slate-50">
                        <span>{ca.code} {ca.name}</span>
                        <span className="font-bold">{parseFloat(String(ca.amount)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg flex justify-between font-bold text-emerald-900 text-sm">
                    <span>Total Assets:</span>
                    <span>UGX {parseFloat(String(bsReport.assets.totalAssets)).toLocaleString()}</span>
                  </div>
                </div>

                {/* Right: Liabilities & Equity */}
                <div className="space-y-4">
                  <div className="font-bold text-slate-900 border-b pb-1 font-sans text-sm">Liabilities & Equity</div>
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase font-sans text-[10px] font-bold">Liabilities</span>
                    {bsReport.liabilities.currentLiabilities.map((cl) => (
                      <div key={cl.code} className="flex justify-between py-1 border-b border-slate-50">
                        <span>{cl.code} {cl.name}</span>
                        <span className="font-bold">{parseFloat(String(cl.amount)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 pt-2">
                    <span className="text-slate-500 uppercase font-sans text-[10px] font-bold">Equity</span>
                    {bsReport.equity.items.map((eq) => (
                      <div key={eq.code} className="flex justify-between py-1 border-b border-slate-50">
                        <span>{eq.code} {eq.name}</span>
                        <span className="font-bold">{parseFloat(String(eq.amount)).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-1 border-b border-slate-50 text-emerald-800 font-bold">
                      <span>Current Year Net Surplus</span>
                      <span>{toNum(bsReport.equity.currentPeriodNetSurplus).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-100 rounded-lg flex justify-between font-bold text-slate-900 text-sm">
                    <span>Total Liabilities & Equity:</span>
                    <span>UGX {toNum(bsReport.totalLiabilitiesAndEquity).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 4: FISCAL PERIODS */}
      {activeTab === "periods" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Fiscal Period Controls</h2>
              <p className="text-xs text-slate-500">Enforce posting cutoffs and month-end closing locks</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase">
                <tr>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">End Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periods.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-800">{p.name}</td>
                    <td className="py-3 px-4">{new Date(p.startDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4">{new Date(p.endDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.status === "OPEN"
                            ? "bg-emerald-100 text-emerald-800"
                            : p.status === "CLOSED"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.status === "OPEN" && (
                        <button
                          onClick={() => handlePeriodAction(p.id, "CLOSE_PERIOD")}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded border border-amber-200"
                        >
                          <Lock size={12} className="inline mr-1" /> Close Period
                        </button>
                      )}
                      {p.status === "CLOSED" && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handlePeriodAction(p.id, "LOCK_PERIOD")}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-bold rounded border border-rose-200"
                          >
                            Lock
                          </button>
                          <button
                            onClick={() => handlePeriodAction(p.id, "REOPEN_PERIOD")}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded border border-emerald-200"
                          >
                            <Unlock size={12} className="inline mr-1" /> Reopen
                          </button>
                        </div>
                      )}
                      {p.status === "LOCKED" && (
                        <span className="text-slate-400 font-semibold text-[11px]">Audit Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SUBLEDGER DRIFT & RECONCILIATION */}
      {activeTab === "reconcile" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900">Subledger-to-GL Real-Time Reconciliation</h2>
              <p className="text-xs text-slate-500">
                Mathematical zero-drift assertions between operational subledgers and double-entry control accounts.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleTriggerReconcile}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
              >
                <Scale size={14} /> Refresh Drift Telemetry
              </button>
              <button
                onClick={handleBootstrapOpening}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} /> Bootstrap Opening Balances
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* AR Reconciliation */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">1. Accounts Receivable (AR)</span>
                {reconciliation?.ar?.isBalanced ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-200">
                    BALANCED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-bold border border-rose-200">
                    DRIFT
                  </span>
                )}
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-500">
                  <span>GL #1200 Control:</span>
                  <span className="font-bold text-slate-800">
                    UGX {toNum(reconciliation?.ar?.glBalance).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Student Ledger Arrears:</span>
                  <span className="font-bold text-slate-800">
                    UGX {toNum(reconciliation?.ar?.subledgerTotal).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Drift Variance:</span>
                  <span className={reconciliation?.ar?.isBalanced ? "text-emerald-700" : "text-rose-700"}>
                    UGX {toNum(reconciliation?.ar?.drift).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Treasury Reconciliation */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">2. Treasury & Cashbook</span>
                {reconciliation?.treasury?.isBalanced ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-200">
                    BALANCED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-bold border border-rose-200">
                    DRIFT
                  </span>
                )}
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-500">
                  <span>GL #11xx Cash & Bank:</span>
                  <span className="font-bold text-slate-800">
                    UGX {toNum(reconciliation?.treasury?.glBalance).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Treasury Repositories:</span>
                  <span className="font-bold text-slate-800">
                    UGX {toNum(reconciliation?.treasury?.subledgerTotal).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Drift Variance:</span>
                  <span className={reconciliation?.treasury?.isBalanced ? "text-emerald-700" : "text-rose-700"}>
                    UGX {toNum(reconciliation?.treasury?.drift).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Inventory Valuation Reconciliation */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">3. Stores Inventory Asset</span>
                {reconciliation?.inventory?.isBalanced ? (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-200">
                    BALANCED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-bold border border-rose-200">
                    DRIFT
                  </span>
                )}
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-500">
                  <span>GL #1310 Stores Asset:</span>
                  <span className="font-bold text-slate-800">
                    UGX {toNum(reconciliation?.inventory?.glBalance).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Store Stock WAC Value:</span>
                  <span className="font-bold text-slate-800">
                    UGX {toNum(reconciliation?.inventory?.subledgerTotal).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Drift Variance:</span>
                  <span className={reconciliation?.inventory?.isBalanced ? "text-emerald-700" : "text-rose-700"}>
                    UGX {toNum(reconciliation?.inventory?.drift).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE JOURNAL MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">New Manual Journal Voucher</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateJournal} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Transaction Date</label>
                  <input
                    type="date"
                    value={journalDate}
                    onChange={e => setJournalDate(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Reference / Voucher Number</label>
                  <input
                    type="text"
                    placeholder="e.g. BD-RES-2026-004"
                    value={journalRef}
                    onChange={e => setJournalRef(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Description / Narration</label>
                <input
                  type="text"
                  placeholder="Comprehensive description of the adjustment"
                  value={journalDesc}
                  onChange={e => setJournalDesc(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  required
                />
              </div>

              {/* Journal Lines */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800 uppercase text-[10px]">Journal Lines</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-emerald-600 hover:text-emerald-800 font-semibold"
                  >
                    + Add Line
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {journalLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 bg-slate-50 p-2 rounded-lg items-center">
                      <div className="col-span-5">
                        <select
                          value={line.accountId}
                          onChange={e => handleLineChange(idx, "accountId", e.target.value)}
                          className="w-full p-1.5 border rounded text-xs"
                          required
                        >
                          <option value="">Select Account...</option>
                          {leafAccounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Line Memo"
                          value={line.description}
                          onChange={e => handleLineChange(idx, "description", e.target.value)}
                          className="w-full p-1.5 border rounded text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Debit"
                          value={line.debit}
                          onChange={e => handleLineChange(idx, "debit", e.target.value)}
                          className="w-full p-1.5 border rounded text-xs font-mono text-right"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Credit"
                          value={line.credit}
                          onChange={e => handleLineChange(idx, "credit", e.target.value)}
                          className="w-full p-1.5 border rounded text-xs font-mono text-right"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Balance Check Footer */}
                <div className="p-3 bg-slate-100 rounded-lg flex justify-between font-mono font-bold text-xs">
                  <div>
                    <span>Total Debits: UGX {totalDebits.toLocaleString()}</span>
                    <span className="mx-2">|</span>
                    <span>Total Credits: UGX {totalCredits.toLocaleString()}</span>
                  </div>
                  <div>
                    {isJournalBalanced ? (
                      <span className="text-emerald-700">✓ Balanced</span>
                    ) : (
                      <span className="text-rose-700">Imbalance: UGX {drift.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDraft}
                    onChange={e => setIsDraft(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span className="text-slate-600 font-semibold">Save as Draft (Maker Mode)</span>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || (!isDraft && !isJournalBalanced)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition-all"
                  >
                    {isPending ? "Posting..." : isDraft ? "Save Draft" : "Post Journal Voucher"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVERSE MODAL */}
      {reversingJournalId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Reverse Journal Voucher</h3>
            <p className="text-xs text-slate-500">
              This action will emit a mirror-image compensating journal entry in the current open period.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Reversal Justification (min 10 characters)
              </label>
              <textarea
                value={reversalReason}
                onChange={e => setReversalReason(e.target.value)}
                placeholder="State the audit justification for reversing this journal..."
                className="w-full p-2 border rounded-lg text-xs"
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setReversingJournalId(null)}
                className="px-4 py-2 border rounded-lg text-xs text-slate-600 hover:bg-slate-50 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleReverseJournal}
                disabled={isPending || reversalReason.trim().length < 10}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all"
              >
                {isPending ? "Reversing..." : "Confirm Reversal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
