"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { amountToWords } from "@/lib/utils/number-to-words";
import {
  CheckCircle2,
  AlertCircle,
  Receipt,
  Sparkles
} from "lucide-react";

interface StudentOption {
  id: string;
  name: string;
  admissionNo: string;
  className: string;
}

interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  grossAmount: string;
  discountAmount: string;
  netAmount: string;
  dueDate: string;
  paidAmount: string;
  outstanding: string;
  status: string;
}

interface ApiAllocation {
  id: string;
  amount: string | number;
  status: string;
}

interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  grossAmount: string | number;
  discountAmount: string | number;
  netAmount: string | number;
  dueDate: string;
  status: string;
  allocations?: ApiAllocation[];
}

export default function PaymentCaptureForm({
  students
}: {
  students: StudentOption[];
}) {
  const router = useRouter();

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loadingStudentData, setLoadingStudentData] = useState(false);
  const [studentBalance, setStudentBalance] = useState<{
    balance: string;
    totalDebits: string;
    totalCredits: string;
  } | null>(null);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);

  // Form Fields
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [externalReference, setExternalReference] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [manualAllocations, setManualAllocations] = useState<
    Record<string, string>
  >({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch student balance and open invoices upon student selection
  useEffect(() => {
    if (!selectedStudentId) {
      return;
    }

    let isMounted = true;

    async function fetchStudentData() {
      try {
        const [balRes, invRes] = await Promise.all([
          fetch(`/api/ledger?studentId=${selectedStudentId}&mode=balance`),
          fetch(`/api/invoices?studentId=${selectedStudentId}`)
        ]);

        if (!isMounted) return;

        if (balRes.ok) {
          const balData = await balRes.json();
          setStudentBalance({
            balance: String(balData.balance),
            totalDebits: String(balData.totalDebits),
            totalCredits: String(balData.totalCredits)
          });
        }

        if (invRes.ok) {
          const invoicesData: ApiInvoice[] = await invRes.json();
          const unpaid = invoicesData.filter(
            (inv) =>
              inv.status === "PENDING" ||
              inv.status === "PARTIAL" ||
              inv.status === "OVERDUE"
          );
          setOpenInvoices(
            unpaid.map((inv) => {
              const paid = inv.allocations
                ? inv.allocations
                    .filter((a) => a.status === "ACTIVE")
                    .reduce((acc: number, a) => acc + Number(a.amount), 0)
                : 0;
              const outstanding = Math.max(0, Number(inv.netAmount) - paid);
              return {
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                grossAmount: String(inv.grossAmount),
                discountAmount: String(inv.discountAmount),
                netAmount: String(inv.netAmount),
                dueDate: inv.dueDate,
                paidAmount: paid.toString(),
                outstanding: outstanding.toString(),
                status: inv.status
              };
            })
          );
        }
      } catch (err) {
        console.error("Failed to load student data", err);
      } finally {
        if (isMounted) {
          setLoadingStudentData(false);
        }
      }
    }

    fetchStudentData();

    return () => {
      isMounted = false;
    };
  }, [selectedStudentId]);

  // Compute live FIFO allocations preview
  const numAmount = parseFloat(amount) || 0;
  let remainingForFifo = numAmount;
  const fifoAllocations: Record<string, number> = {};

  for (const inv of openInvoices) {
    const outstanding = parseFloat(inv.outstanding) || 0;
    if (remainingForFifo > 0 && outstanding > 0) {
      const alloc = Math.min(remainingForFifo, outstanding);
      fifoAllocations[inv.id] = alloc;
      remainingForFifo -= alloc;
    } else {
      fifoAllocations[inv.id] = 0;
    }
  }

  const unallocatedAmount = Math.max(0, remainingForFifo);

  const handleManualAllocChange = (invoiceId: string, val: string) => {
    setManualAllocations((prev) => ({
      ...prev,
      [invoiceId]: val
    }));
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    if (studentId) {
      setLoadingStudentData(true);
    } else {
      setStudentBalance(null);
      setOpenInvoices([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setErrorMessage("Please select a student.");
      return;
    }
    if (numAmount <= 0) {
      setErrorMessage("Please enter a valid payment amount greater than zero.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      let allocationsPayload: Array<{ invoiceId: string; amount: number }> | undefined = undefined;

      if (isManualOverride) {
        allocationsPayload = Object.entries(manualAllocations)
          .filter(([, val]) => parseFloat(val) > 0)
          .map(([invoiceId, val]) => ({
            invoiceId,
            amount: parseFloat(val)
          }));
      }

      const idempotencyKey = `MANUAL:${crypto.randomUUID()}`;

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          amount: numAmount.toFixed(2),
          paymentMethod,
          paymentDate,
          externalReference: externalReference.trim() || undefined,
          payerName: payerName.trim() || undefined,
          payerPhone: payerPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          idempotencyKey,
          manualAllocations: allocationsPayload
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to record payment");
      }

      const payment = await res.json();
      router.push(`/finance/receipts/${payment.id}`);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Student Selection & Live Balance Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
              1
            </span>
            Select Student &amp; Account Status
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-2">
            <label htmlFor="studentSelect" className="block text-sm font-semibold text-foreground">
              Student <span className="text-red-500">*</span>
            </label>
            <select
              id="studentSelect"
              value={selectedStudentId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSelectStudent(e.target.value)}
              className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              <option value="">-- Choose Student --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.admissionNo}) — {s.className}
                </option>
              ))}
            </select>
          </div>

          {/* Balance Pill */}
          <div className="bg-muted/40 border border-border rounded-lg p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Current Authoritative Balance
            </div>
            {loadingStudentData ? (
              <div className="text-sm text-muted-foreground mt-2 animate-pulse">
                Calculating ledger balance...
              </div>
            ) : studentBalance ? (
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono">
                  {Number(studentBalance.balance) > 0 ? (
                    <span className="text-rose-600 dark:text-rose-400">
                      UGX {Number(studentBalance.balance).toLocaleString()} (Owed)
                    </span>
                  ) : Number(studentBalance.balance) < 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      UGX {Math.abs(Number(studentBalance.balance)).toLocaleString()} (Advance Credit)
                    </span>
                  ) : (
                    <span className="text-muted-foreground">UGX 0.00 (Settled in Full)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-4">
                  <span>Total Billed: UGX {Number(studentBalance.totalDebits).toLocaleString()}</span>
                  <span>Total Paid: UGX {Number(studentBalance.totalCredits).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground mt-2">
                Select a student above to inspect debtor/credit status.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Information */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
            2
          </span>
          Payment Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label htmlFor="amount" className="block text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Amount (UGX) <span className="text-red-500">*</span>
            </label>
            <input
              id="amount"
              type="number"
              min="1"
              step="any"
              placeholder="e.g. 500000"
              value={amount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
              className="flex h-10 w-full rounded-md border border-emerald-300 dark:border-emerald-700 bg-background px-3 py-2 text-lg font-bold font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="paymentMethod" className="block text-sm font-semibold text-foreground">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPaymentMethod(e.target.value)}
              className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Slip / Transfer</option>
              <option value="MTN_MOMO">MTN Mobile Money</option>
              <option value="AIRTEL_MONEY">Airtel Money</option>
              <option value="SCHOOLPAY">SchoolPay</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CARD">Debit / Credit Card</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="paymentDate" className="block text-sm font-semibold text-foreground">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
        </div>

        {/* Amount in Words Live Banner */}
        {numAmount > 0 && (
          <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                Amount in Words (Official Receipt Snapshot):
              </span>
              <span className="font-medium text-emerald-950 dark:text-emerald-100">
                {amountToWords(numAmount.toString(), "Uganda Shillings")}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label htmlFor="externalReference" className="block text-sm font-medium text-foreground">
              External Reference / Slip No / TxID
            </label>
            <input
              id="externalReference"
              placeholder="e.g. MOMO-98402, SLIP-44021"
              value={externalReference}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExternalReference(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="payerName" className="block text-sm font-medium text-foreground">
              Payer Full Name
            </label>
            <input
              id="payerName"
              placeholder="e.g. David Kato (Father)"
              value={payerName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayerName(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="payerPhone" className="block text-sm font-medium text-foreground">
              Payer Phone Number
            </label>
            <input
              id="payerPhone"
              placeholder="e.g. 0772 123456"
              value={payerPhone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayerPhone(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="notes" className="block text-sm font-medium text-foreground">
            Payment Notes
          </label>
          <input
            id="notes"
            placeholder="Optional cashier notes or comments"
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* FIFO / Manual Invoice Settlement Allocation Breakdown */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                3
              </span>
              Invoice Settlement &amp; Allocations
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isManualOverride
                ? "Manual Mode: You explicitly control how much settles each invoice."
                : "Automatic FIFO Mode: Earliest due invoices are settled first."}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsManualOverride(!isManualOverride)}
            className="text-xs font-medium"
          >
            {isManualOverride ? "Switch to Auto FIFO" : "Manual Allocation Override"}
          </Button>
        </div>

        {openInvoices.length === 0 ? (
          <div className="p-6 text-center bg-muted/20 border border-dashed border-border rounded-lg">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-medium text-foreground">No unpaid invoices pending</p>
            <p className="text-xs text-muted-foreground mt-1">
              Any amount paid will be credited to the student&apos;s subledger as an Advance Deposit.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground uppercase border-b border-border">
                    <th className="py-2.5 px-4 text-left font-semibold">Invoice No</th>
                    <th className="py-2.5 px-4 text-left font-semibold">Due Date</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Net Total</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Outstanding</th>
                    <th className="py-2.5 px-4 text-right font-semibold">
                      {isManualOverride ? "Manual Alloc (UGX)" : "FIFO Alloc (UGX)"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {openInvoices.map((inv) => {
                    const alloc = isManualOverride
                      ? parseFloat(manualAllocations[inv.id] || "0")
                      : fifoAllocations[inv.id] || 0;
                    return (
                      <tr key={inv.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-4 font-mono font-medium text-xs">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground">
                          {new Date(inv.dueDate).toLocaleDateString("en-GB")}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs">
                          UGX {Number(inv.netAmount).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold text-rose-600">
                          UGX {Number(inv.outstanding).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-sm">
                          {isManualOverride ? (
                            <input
                              type="number"
                              min="0"
                              max={inv.outstanding}
                              step="any"
                              value={manualAllocations[inv.id] || ""}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                handleManualAllocChange(inv.id, e.target.value)
                              }
                              placeholder="0"
                              className="h-8 w-32 ml-auto text-right font-mono text-xs flex rounded-md border border-input bg-background px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          ) : (
                            <span
                              className={`font-semibold ${
                                alloc > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                              }`}
                            >
                              UGX {alloc.toLocaleString()}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Unallocated Credit Banner */}
            {unallocatedAmount > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs flex items-center justify-between text-blue-800 dark:text-blue-300">
                <span className="font-medium">
                  Remaining Unallocated Liquidity (Held as Student Advance Credit):
                </span>
                <span className="font-mono font-bold text-sm">
                  UGX {unallocatedAmount.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form Submission Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6 shadow-sm"
          disabled={isSubmitting || !selectedStudentId || numAmount <= 0}
        >
          {isSubmitting ? (
            "Processing & Issuing Receipt..."
          ) : (
            <>
              <Receipt className="w-4 h-4" />
              Capture Payment &amp; Issue Receipt
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
