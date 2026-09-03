"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Receipt,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlusCircle,
  Search,
  ShieldCheck,
  CreditCard
} from "lucide-react";

interface SerializedSupplier {
  id: string;
  supplierCode: string;
  name: string;
  tradeName?: string | null;
  contactName?: string | null;
  phone: string;
  email?: string | null;
  taxIdNumber?: string | null;
  paymentTermsDays: number;
  creditLimitUGX: string;
  isCreditBlocked: boolean;
  currentBalanceUGX: string;
  vatRegistered: boolean;
  whtExempt: boolean;
  isActive: boolean;
}

interface SerializedInvoice {
  id: string;
  invoiceNumber: string;
  vendorInvoiceNumber: string;
  supplierId: string;
  supplierName: string;
  invoiceDate: string;
  dueDate: string;
  grossAmount: string;
  taxAmount: string;
  discountAmount: string;
  netPayableAmount: string;
  amountPaid: string;
  amountOutstanding: string;
  ppvAmount: string;
  status: string;
  matchStatus?: string | null;
  holdReason?: string | null;
}

interface SerializedCreditNote {
  id: string;
  creditNoteNumber: string;
  vendorCreditNoteRef?: string | null;
  supplierId: string;
  supplierName: string;
  creditNoteDate: string;
  grossAmount: string;
  taxAmount: string;
  netCreditAmount: string;
  unallocatedAmount: string;
  reason: string;
  status: string;
}

interface SerializedPayment {
  id: string;
  paymentNumber: string;
  supplierId: string;
  supplierName: string;
  treasuryAccountName: string;
  paymentDate: string;
  totalAmountPaid: string;
  whtDeductedAmount: string;
  discountTakenAmount: string;
  unallocatedAmount: string;
  paymentMethod: string;
  referenceNumber?: string | null;
  status: string;
}

interface ReconciliationData {
  isReconciled: boolean;
  apControl: {
    subledgerTotalAP: string;
    glBalance2110: string;
    varianceAP: string;
    isReconciled: boolean;
  };
  grniControl: {
    subledgerTotalGRNI: string;
    glBalance2120: string;
    varianceGRNI: string;
    isReconciled: boolean;
  };
}

interface AccountsPayableClientProps {
  suppliers: SerializedSupplier[];
  invoices: SerializedInvoice[];
  creditNotes: SerializedCreditNote[];
  payments: SerializedPayment[];
  treasuryAccounts: Array<{ id: string; name: string; code: string; currentBalance: string }>;
  fiscalPeriods: Array<{ id: string; name: string; status: string }>;
  reconciliation: ReconciliationData;
  agedSummary: {
    current: string;
    days31to60: string;
    days61to90: string;
    days90Plus: string;
    grandTotal: string;
  };
  grniTotal: string;
}

export function AccountsPayableClient({
  suppliers,
  invoices,
  creditNotes,
  payments,
  treasuryAccounts,
  fiscalPeriods,
  reconciliation,
  agedSummary,
  grniTotal
}: AccountsPayableClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"invoices" | "suppliers" | "credit-notes" | "payments" | "aging" | "reconcile">("invoices");
  const [search, setSearch] = useState("");
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [isNewPaymentOpen, setIsNewPaymentOpen] = useState(false);
  const [isNewCreditNoteOpen, setIsNewCreditNoteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtered lists
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.supplierCode.toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search)
  );

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.vendorInvoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.supplierName.toLowerCase().includes(search.toLowerCase())
  );

  const formatUGX = (val: string | number) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? "UGX 0" : `UGX ${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const handleApproveInvoice = async (id: string) => {
    if (!confirm("Are you sure you want to approve this supplier invoice and post to General Ledger?")) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/finance/ap/invoices/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to approve invoice");
      }
      router.refresh();
    } catch (e: unknown) {
      setErrorMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCreditNote = async (id: string) => {
    if (!confirm("Are you sure you want to approve this credit note and post to General Ledger?")) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/finance/ap/credit-notes/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to approve credit note");
      }
      router.refresh();
    } catch (e: unknown) {
      setErrorMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReversePayment = async (id: string) => {
    const reason = prompt("Enter reversal reason (dishonored cheque / cancelled payment):");
    if (!reason) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/finance/ap/payments/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to reverse payment");
      }
      router.refresh();
    } catch (e: unknown) {
      setErrorMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm mb-1">
            <Building2 className="w-4 h-4" />
            Finance & Procurement Subledger
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Accounts Payable & Supplier Credit
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage vendor masters, 3-way invoice matching, prompt discounts, WHT deduction & subledger telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsNewInvoiceOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            New Supplier Bill
          </button>
          <button
            onClick={() => setIsNewPaymentOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition shadow-sm"
          >
            <CreditCard className="w-4 h-4" />
            Disburse Payment
          </button>
          <button
            onClick={() => setIsNewSupplierOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition"
          >
            <Building2 className="w-4 h-4" />
            Add Vendor
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Outstanding AP</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatUGX(agedSummary.grandTotal)}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-medium text-emerald-600">{formatUGX(agedSummary.current)}</span> current (0-30d)
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Overdue AP (31+ Days)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {formatUGX(
              (
                parseFloat(agedSummary.days31to60) +
                parseFloat(agedSummary.days61to90) +
                parseFloat(agedSummary.days90Plus)
              ).toString()
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {formatUGX(agedSummary.days90Plus)} over 90 days overdue
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>GRNI Accrual (#2120)</span>
            <Receipt className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{formatUGX(grniTotal)}</div>
          <div className="text-xs text-slate-500 mt-1">Uninvoiced goods received awaiting vendor bills</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Zero-Drift Telemetry</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                reconciliation.isReconciled ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {reconciliation.isReconciled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {reconciliation.isReconciled ? "100% In Equilibrium" : "Subledger Variance"}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            GL #2110: {formatUGX(reconciliation.apControl.glBalance2110)}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "invoices" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Invoices & 3-Way Match ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "suppliers" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Vendors ({suppliers.length})
          </button>
          <button
            onClick={() => setActiveTab("credit-notes")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "credit-notes" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Credit Notes ({creditNotes.length})
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "payments" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Settlements ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab("aging")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "aging" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Aged Payables
          </button>
          <button
            onClick={() => setActiveTab("reconcile")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "reconcile" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            GL Control #2110
          </button>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* TAB 1: INVOICES & 3-WAY MATCHING */}
      {activeTab === "invoices" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Bill Ref</th>
                  <th className="py-3 px-4">Date / Due</th>
                  <th className="py-3 px-4 text-right">Net Payable</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-center">3-Way Match</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No supplier invoices found. Click &quot;New Supplier Bill&quot; to record an invoice.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-medium text-indigo-600">{inv.invoiceNumber}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{inv.supplierName}</td>
                      <td className="py-3 px-4 text-slate-600">{inv.vendorInvoiceNumber}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        <div>{new Date(inv.invoiceDate).toLocaleDateString()}</div>
                        <div className="text-slate-400">Due: {new Date(inv.dueDate).toLocaleDateString()}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">{formatUGX(inv.netPayableAmount)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-rose-600">{formatUGX(inv.amountOutstanding)}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            inv.matchStatus === "PERFECT_MATCH"
                              ? "bg-emerald-50 text-emerald-700"
                              : inv.matchStatus === "PRICE_VARIANCE_PASS"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {inv.matchStatus || "STANDARD"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            inv.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : inv.status === "APPROVED"
                              ? "bg-blue-100 text-blue-800"
                              : inv.status === "MATCHED"
                              ? "bg-amber-100 text-amber-800"
                              : inv.status === "ON_HOLD" || inv.status === "DISPUTED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(inv.status === "MATCHED" || inv.status === "DRAFT") && (
                          <button
                            onClick={() => handleApproveInvoice(inv.id)}
                            disabled={loading}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition"
                          >
                            Approve
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
      )}

      {/* TAB 2: VENDORS */}
      {activeTab === "suppliers" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4">Phone / Email</th>
                  <th className="py-3 px-4">Tax TIN</th>
                  <th className="py-3 px-4">Terms</th>
                  <th className="py-3 px-4 text-right">Credit Limit</th>
                  <th className="py-3 px-4 text-right">Balance (Payable)</th>
                  <th className="py-3 px-4 text-center">WHT Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">{s.supplierCode}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{s.name}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      <div>{s.phone}</div>
                      <div className="text-slate-400">{s.email || "No email"}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs font-mono">{s.taxIdNumber || "N/A"}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{s.paymentTermsDays} Days</td>
                    <td className="py-3 px-4 text-right text-slate-700">{formatUGX(s.creditLimitUGX)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-rose-600">{formatUGX(s.currentBalanceUGX)}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          s.whtExempt ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {s.whtExempt ? "WHT Exempt" : "Standard 6%"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CREDIT NOTES */}
      {activeTab === "credit-notes" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Credit Note #</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Net Credit</th>
                  <th className="py-3 px-4 text-right">Unallocated</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No supplier credit notes found.
                    </td>
                  </tr>
                ) : (
                  creditNotes.map((crn) => (
                    <tr key={crn.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-medium text-indigo-600">{crn.creditNoteNumber}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{crn.supplierName}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{new Date(crn.creditNoteDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs">{crn.reason}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{formatUGX(crn.netCreditAmount)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">{formatUGX(crn.unallocatedAmount)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          {crn.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {crn.status === "DRAFT" && (
                          <button
                            onClick={() => handleApproveCreditNote(crn.id)}
                            disabled={loading}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition"
                          >
                            Approve
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
      )}

      {/* TAB 4: SETTLEMENTS & PAYMENTS */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Payment #</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Treasury Account</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Total Settled</th>
                  <th className="py-3 px-4 text-right">WHT 6%</th>
                  <th className="py-3 px-4 text-right">Discount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No supplier settlement payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-medium text-emerald-600">{p.paymentNumber}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{p.supplierName}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs">{p.treasuryAccountName}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{new Date(p.paymentDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{formatUGX(p.totalAmountPaid)}</td>
                      <td className="py-3 px-4 text-right text-amber-600 font-mono text-xs">{formatUGX(p.whtDeductedAmount)}</td>
                      <td className="py-3 px-4 text-right text-emerald-600 font-mono text-xs">{formatUGX(p.discountTakenAmount)}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            p.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {p.status === "COMPLETED" && (
                          <button
                            onClick={() => handleReversePayment(p.id)}
                            disabled={loading}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition"
                          >
                            Reverse
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
      )}

      {/* TAB 5: AGED PAYABLES */}
      {activeTab === "aging" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Aged Payables Schedule</h3>
            <span className="text-xs text-slate-400 font-medium">As of {new Date().toLocaleDateString()}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl">
            <div>
              <div className="text-xs text-slate-500 font-medium">Current (0-30 Days)</div>
              <div className="text-xl font-bold text-emerald-600">{formatUGX(agedSummary.current)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">31 - 60 Days</div>
              <div className="text-xl font-bold text-blue-600">{formatUGX(agedSummary.days31to60)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">61 - 90 Days</div>
              <div className="text-xl font-bold text-amber-600">{formatUGX(agedSummary.days61to90)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">90+ Days (Critical)</div>
              <div className="text-xl font-bold text-rose-600">{formatUGX(agedSummary.days90Plus)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Total Liability</div>
              <div className="text-xl font-bold text-slate-900">{formatUGX(agedSummary.grandTotal)}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: GL CONTROL #2110 & #2120 TELEMETRY */}
      {activeTab === "reconcile" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Subledger-to-GL Zero-Drift Telemetry</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative validation that supplier subledger balances and GRNI schedules reconcile exactly to double-entry general ledger control accounts.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              Live Telemetry
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AP Control #2110 */}
            <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">AP Suppliers Control (#2110)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                  Zero Drift
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Authoritative Subledger Total:</span>
                  <span className="font-semibold text-slate-900">{formatUGX(reconciliation.apControl.subledgerTotalAP)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GL #2110 Control Account Balance:</span>
                  <span className="font-semibold text-slate-900">{formatUGX(reconciliation.apControl.glBalance2110)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                  <span>Variance:</span>
                  <span className="text-emerald-600">{formatUGX(reconciliation.apControl.varianceAP)}</span>
                </div>
              </div>
            </div>

            {/* GRNI Control #2120 */}
            <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">GRNI Clearing Accrual (#2120)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                  Zero Drift
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Authoritative GRNI Schedule Total:</span>
                  <span className="font-semibold text-slate-900">{formatUGX(reconciliation.grniControl.subledgerTotalGRNI)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GL #2120 Control Account Balance:</span>
                  <span className="font-semibold text-slate-900">{formatUGX(reconciliation.grniControl.glBalance2120)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                  <span>Variance:</span>
                  <span className="text-emerald-600">{formatUGX(reconciliation.grniControl.varianceGRNI)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
