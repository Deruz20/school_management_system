"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  CreditCard,
  Plus,
  AlertCircle,
  FileText,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight
} from "lucide-react";
import { LedgerDirection, LedgerEntryType } from "@prisma/client";

interface StudentOption {
  id: string;
  name: string;
  admissionNo: string;
  className: string;
}

interface AcademicYearOption {
  id: string;
  name: string;
}

interface StatementTransaction {
  id: string;
  postedAt: string;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amount: string;
  referenceType: string;
  referenceId: string | null;
  description: string;
  balanceAfter: string;
  debit: string | null;
  credit: string | null;
}

interface StatementData {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    admissionNo: string;
    className: string;
    streamName: string | null;
  };
  transactions: StatementTransaction[];
  summary: {
    totalDebits: string;
    totalCredits: string;
    closingBalance: string;
  };
}

export default function StudentLedgerView({
  students,
  academicYears,
  initialStudentId
}: {
  students: StudentOption[];
  academicYears: AcademicYearOption[];
  initialStudentId?: string;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState(
    initialStudentId || (students[0]?.id || "")
  );
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Modals
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showAdjModal, setShowAdjModal] = useState(false);

  // Opening Balance form state
  const [opDirection, setOpDirection] = useState<LedgerDirection>(LedgerDirection.DEBIT);
  const [opAmount, setOpAmount] = useState("");
  const [opReason, setOpReason] = useState("");
  const [opYearId, setOpYearId] = useState("");
  const [opSubmitting, setOpSubmitting] = useState(false);

  // Adjustment form state
  const [adjDirection, setAdjDirection] = useState<LedgerDirection>(LedgerDirection.CREDIT);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  const fetchStatement = async (studentId: string) => {
    if (!studentId) return;
    setErrorMessage("");
    try {
      const res = await fetch(`/api/ledger?studentId=${studentId}&mode=statement`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data: StatementData = await res.json();
      setStatementData(data);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Failed to load ledger statement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
      let isMounted = true;
      async function load() {
        try {
          const res = await fetch(`/api/ledger?studentId=${selectedStudentId}&mode=statement`);
          if (!isMounted) return;
          if (!res.ok) {
            throw new Error(await res.text());
          }
          const data: StatementData = await res.json();
          setStatementData(data);
        } catch (err: unknown) {
          if (isMounted) {
            setErrorMessage((err as Error).message || "Failed to load ledger statement");
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      }

      load();

      return () => {
        isMounted = false;
      };
    }
  }, [selectedStudentId]);

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    if (studentId) {
      setLoading(true);
    } else {
      setStatementData(null);
    }
  };

  const handlePostOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !opAmount || !opReason) return;
    setOpSubmitting(true);
    try {
      const res = await fetch("/api/ledger/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          academicYearId: opYearId || undefined,
          direction: opDirection,
          amount: parseFloat(opAmount),
          reason: opReason
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setShowOpeningModal(false);
      setOpAmount("");
      setOpReason("");
      fetchStatement(selectedStudentId);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setOpSubmitting(false);
    }
  };

  const handlePostAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !adjAmount || !adjReason) return;
    setAdjSubmitting(true);
    try {
      const res = await fetch("/api/ledger/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          direction: adjDirection,
          amount: parseFloat(adjAmount),
          reason: adjReason
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setShowAdjModal(false);
      setAdjAmount("");
      setAdjReason("");
      fetchStatement(selectedStudentId);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setAdjSubmitting(false);
    }
  };

  const getEntryBadge = (type: LedgerEntryType) => {
    switch (type) {
      case "INVOICE_GROSS_CHARGE":
        return <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">Invoice Charge</span>;
      case "BURSARY_CREDIT":
        return <span className="text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">Bursary Concession</span>;
      case "PAYMENT":
        return <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Payment</span>;
      case "PAYMENT_REVERSAL":
        return <span className="text-[11px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">Payment Reversal</span>;
      case "OPENING_BALANCE":
        return <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">Opening Balance</span>;
      case "INVOICE_VOID_REVERSAL":
        return <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">Invoice Void Credit</span>;
      case "BURSARY_VOID_REVERSAL":
        return <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">Bursary Void Debit</span>;
      case "CREDIT_ADJUSTMENT":
        return <span className="text-[11px] px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold">Credit Adjustment</span>;
      case "DEBIT_ADJUSTMENT":
        return <span className="text-[11px] px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold">Debit Adjustment</span>;
      default:
        return <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Student Selector & Action Toolbar */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="w-full md:w-96 space-y-1.5">
          <label htmlFor="studentSelect" className="block font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            Select Student Account:
          </label>
          <select
            id="studentSelect"
            value={selectedStudentId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSelectStudent(e.target.value)}
            className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.admissionNo}) — {s.className}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOpeningModal(true)}
            className="text-xs gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            Post Opening Balance
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdjModal(true)}
            className="text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Manual Adjustment
          </Button>
        </div>
      </div>

      {/* Summary Financial Cards */}
      {statementData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              <span>Total Billed (Debits)</span>
              <ArrowDownLeft className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground mt-2">
              UGX {Number(statementData.summary.totalDebits).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gross invoices, arrears, &amp; charge adjustments
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              <span>Total Credits</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-2">
              UGX {Number(statementData.summary.totalCredits).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Payments, bursaries, &amp; waivers
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              <span>Authoritative Closing Balance</span>
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold font-mono mt-2">
              {Number(statementData.summary.closingBalance) > 0 ? (
                <span className="text-rose-600 dark:text-rose-400">
                  UGX {Number(statementData.summary.closingBalance).toLocaleString()} (Due)
                </span>
              ) : Number(statementData.summary.closingBalance) < 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  UGX {Math.abs(Number(statementData.summary.closingBalance)).toLocaleString()} (Advance Credit)
                </span>
              ) : (
                <span className="text-muted-foreground">UGX 0.00 (Cleared)</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Exact subledger balance: ∑(Debits) - ∑(Credits)
            </p>
          </div>
        </div>
      )}

      {/* Subledger Journal Entries Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Accounts Receivable Subsidiary Journal ({statementData?.transactions.length || 0} Entries)
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Loading student subsidiary ledger...
          </div>
        ) : !statementData || statementData.transactions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            No ledger entries found for this student.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Entry Type</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="text-right font-semibold text-blue-600">Debit / Charge (+)</TableHead>
                <TableHead className="text-right font-semibold text-emerald-600">Credit / Payment (-)</TableHead>
                <TableHead className="text-right font-semibold">Running Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statementData.transactions.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(tx.postedAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    })}
                  </TableCell>
                  <TableCell>{getEntryBadge(tx.entryType)}</TableCell>
                  <TableCell className="text-sm font-medium text-foreground max-w-xs truncate">
                    {tx.description}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-xs text-blue-700 dark:text-blue-400">
                    {tx.debit ? `UGX ${Number(tx.debit).toLocaleString()}` : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-xs text-emerald-700 dark:text-emerald-400">
                    {tx.credit ? `UGX ${Number(tx.credit).toLocaleString()}` : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-xs">
                    UGX {Number(tx.balanceAfter).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Opening Balance Modal */}
      {showOpeningModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handlePostOpeningBalance} className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              Post Opening Balance / Historical Arrears
            </h3>
            <p className="text-xs text-muted-foreground">
              Record historical debt or advance credits brought forward from prior academic years or legacy software.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">Balance Type:</label>
                <select
                  value={opDirection}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setOpDirection(e.target.value as LedgerDirection)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value={LedgerDirection.DEBIT}>Historical Arrears (Student Owes Money)</option>
                  <option value={LedgerDirection.CREDIT}>Historical Advance Deposit (Student Held Credit)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">Amount (UGX):</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={opAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpAmount(e.target.value)}
                  placeholder="e.g. 350000"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">Mandatory Reason:</label>
                <input
                  value={opReason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpReason(e.target.value)}
                  placeholder="e.g. 2025 Term 3 Unpaid Balance brought forward"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">Originating Academic Year (Optional):</label>
                <select
                  value={opYearId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setOpYearId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="">-- Optional Year --</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowOpeningModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={opSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                {opSubmitting ? "Posting..." : "Post Opening Balance"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Manual Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handlePostAdjustment} className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Manual Subledger Adjustment
            </h3>
            <p className="text-xs text-muted-foreground">
              Post an audited manual charge penalty (Debit) or authorized fee concession/waiver (Credit).
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">Adjustment Direction:</label>
                <select
                  value={adjDirection}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdjDirection(e.target.value as LedgerDirection)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value={LedgerDirection.CREDIT}>Credit (Waiver / Scholarship / Concession)</option>
                  <option value={LedgerDirection.DEBIT}>Debit (Extra Charge / Late Penalty / Fine)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">Amount (UGX):</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={adjAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdjAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">Mandatory Audit Reason:</label>
                <input
                  value={adjReason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdjReason(e.target.value)}
                  placeholder="e.g. Board approved 50k hardship fee waiver"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAdjModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={adjSubmitting} className="bg-primary text-primary-foreground">
                {adjSubmitting ? "Posting..." : "Post Adjustment"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
