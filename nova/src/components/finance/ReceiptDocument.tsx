"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Printer,
  RotateCcw,
  CheckCircle2,
  Calendar
} from "lucide-react";
import { PaymentMethod, ReceiptStatus } from "@prisma/client";

interface ReceiptProps {
  receipt: {
    id: string;
    receiptNumber: string;
    issuedAt: string;
    cashierName: string;
    status: ReceiptStatus;
    voidedAt: string | null;
    voidReason: string | null;
    amountFigures: string;
    amountWords: string;
    paymentMethod: PaymentMethod;
    externalReference: string | null;
  };
  school: {
    name: string;
    branchName: string;
    logoUrl: string | null;
    motto: string | null;
  };
  student: {
    id: string;
    fullName: string;
    admissionNo: string;
    className: string;
    streamName: string | null;
  };
  settlementBreakdown: Array<{
    invoiceNumber: string;
    allocatedAmount: string;
    invoiceNetAmount: string;
    dueDate: string;
  }>;
  accountSummary: {
    currentStudentBalance: string;
    totalBilledToDate: string;
    totalPaidToDate: string;
  };
  paymentId: string;
}

export default function ReceiptDocument({
  receipt,
  school,
  student,
  settlementBreakdown,
  accountSummary,
  paymentId
}: ReceiptProps) {
  const router = useRouter();
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [isReversing, setIsReversing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handlePrint = () => {
    window.print();
  };

  const handleReverse = async () => {
    if (!reversalReason.trim()) {
      setErrorMessage("Please enter a mandatory reversal reason.");
      return;
    }

    setIsReversing(true);
    setErrorMessage("");

    try {
      const res = await fetch(`/api/payments/${paymentId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reversalReason.trim() })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to reverse payment.");
      }

      setShowReverseModal(false);
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsReversing(false);
    }
  };

  const isVoid = receipt.status === ReceiptStatus.VOID;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Action Bar (Hidden during Print) */}
      <div className="print:hidden flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          {isVoid ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              RECEIPT VOIDED
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              OFFICIAL RECEIPT (VALID)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isVoid && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReverseModal(true)}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Reverse Payment
            </Button>
          )}

          <Button
            onClick={handlePrint}
            className="bg-primary text-primary-foreground gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Official Receipt
          </Button>
        </div>
      </div>

      {/* Printable Receipt Paper Container */}
      <div className="bg-white text-slate-900 border border-slate-200 shadow-lg rounded-xl p-8 sm:p-12 relative overflow-hidden print:border-none print:shadow-none print:p-0">
        {/* Void Watermark */}
        {isVoid && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
            <span className="text-8xl font-black text-red-500/15 tracking-widest rotate-[-30deg] border-8 border-red-500/20 px-12 py-4 rounded-3xl">
              VOID
            </span>
          </div>
        )}

        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900">
              {school.name}
            </h1>
            <p className="text-sm font-semibold text-slate-600">
              {school.branchName}
            </p>
            {school.motto && (
              <p className="text-xs italic text-slate-500 mt-0.5">&ldquo;{school.motto}&rdquo;</p>
            )}
          </div>

          <div className="text-right">
            <div className="text-xs uppercase tracking-widest font-mono text-slate-500">
              Official Fee Receipt
            </div>
            <div className="text-xl font-mono font-bold text-slate-900 mt-1">
              {receipt.receiptNumber}
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center justify-end gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(receipt.issuedAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric"
              })}
            </div>
          </div>
        </div>

        {/* Void Reason Banner */}
        {isVoid && (
          <div className="my-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs font-medium">
            <span className="font-bold">VOID DETAILS:</span> {receipt.voidReason} (Voided on{" "}
            {new Date(receipt.voidedAt!).toLocaleDateString("en-GB")})
          </div>
        )}

        {/* Student & Payment Summary Grid */}
        <div className="grid grid-cols-2 gap-8 my-6 py-4 border-b border-slate-200 text-sm">
          <div className="space-y-1.5">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Student Details
            </div>
            <div className="font-bold text-base text-slate-900">{student.fullName}</div>
            <div className="text-xs text-slate-700 font-mono">
              Adm No: <span className="font-bold">{student.admissionNo}</span>
            </div>
            <div className="text-xs text-slate-700">
              Class: <span className="font-medium">{student.className}</span>{" "}
              {student.streamName && `(${student.streamName})`}
            </div>
          </div>

          <div className="space-y-1.5 text-right">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Payment Method & Channel
            </div>
            <div className="font-bold text-base text-slate-900">
              {receipt.paymentMethod.replace("_", " ")}
            </div>
            {receipt.externalReference && (
              <div className="text-xs font-mono text-slate-700">
                Ref: {receipt.externalReference}
              </div>
            )}
            <div className="text-xs text-slate-600">
              Cashier: <span className="font-medium">{receipt.cashierName}</span>
            </div>
          </div>
        </div>

        {/* Amount Figures & Words Hero */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 my-6">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
              Amount Received:
            </span>
            <span className="text-2xl font-mono font-black text-slate-900">
              UGX {Number(receipt.amountFigures).toLocaleString()}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-700">
            <span className="font-bold text-slate-600 uppercase">In Words: </span>
            <span className="italic font-medium">{receipt.amountWords}</span>
          </div>
        </div>

        {/* Settlement Breakdown Table */}
        <div className="my-6">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">
            Invoice Settlement Allocation Breakdown
          </div>
          {settlementBreakdown.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-600 rounded">
              Payment held entirely as Student Advance Credit (No open invoices settled).
            </div>
          ) : (
            <table className="w-full text-xs border border-slate-200 rounded">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="py-2 px-3 text-left font-bold">Invoice No</th>
                  <th className="py-2 px-3 text-left font-bold">Due Date</th>
                  <th className="py-2 px-3 text-right font-bold">Invoice Net Amount</th>
                  <th className="py-2 px-3 text-right font-bold">Allocated Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {settlementBreakdown.map((s, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                      {s.invoiceNumber}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {new Date(s.dueDate).toLocaleDateString("en-GB")}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      UGX {Number(s.invoiceNetAmount).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                      UGX {Number(s.allocatedAmount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Student Account Summary Footer */}
        <div className="mt-8 pt-4 border-t-2 border-slate-900 grid grid-cols-2 items-end">
          <div className="space-y-1 text-xs text-slate-600">
            <div>
              Total Invoiced to Date:{" "}
              <span className="font-mono font-semibold">
                UGX {Number(accountSummary.totalBilledToDate).toLocaleString()}
              </span>
            </div>
            <div>
              Total Paid to Date:{" "}
              <span className="font-mono font-semibold">
                UGX {Number(accountSummary.totalPaidToDate).toLocaleString()}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 pt-1">
              Outstanding Account Balance:{" "}
              <span className="font-mono">
                {Number(accountSummary.currentStudentBalance) > 0
                  ? `UGX ${Number(accountSummary.currentStudentBalance).toLocaleString()} (Due)`
                  : Number(accountSummary.currentStudentBalance) < 0
                  ? `UGX ${Math.abs(Number(accountSummary.currentStudentBalance)).toLocaleString()} (Credit)`
                  : "UGX 0.00 (Cleared)"}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block border-t border-slate-400 pt-1 px-8 text-center text-xs text-slate-600">
              <div className="font-bold text-slate-900">{receipt.cashierName}</div>
              Authorized Cashier Signature
            </div>
          </div>
        </div>
      </div>

      {/* Payment Reversal Modal */}
      {showReverseModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-lg">
              <RotateCcw className="w-5 h-5" />
              Reverse Payment Transaction
            </div>

            <p className="text-sm text-muted-foreground">
              Reversing this payment will mark the receipt as VOID, cancel invoice allocations,
              reopen settled invoices, and post a compensating debit to the student subledger.
            </p>

            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-xs">
                {errorMessage}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Mandatory Reversal Reason:
              </label>
              <textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Bounced Cheque #4029, Cashier incorrect amount entry..."
                rows={3}
                className="w-full rounded-md border border-input bg-background p-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowReverseModal(false)}
                disabled={isReversing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReverse}
                disabled={isReversing || !reversalReason.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isReversing ? "Reversing..." : "Confirm Reversal"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
