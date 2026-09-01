import { requireAuth } from "@/lib/auth/require-auth";
import { PaymentDAO } from "@/lib/dao/payment.dao";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Receipt, Plus, RotateCcw, CreditCard, CheckCircle2 } from "lucide-react";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

export default async function PaymentsPage({
  searchParams
}: {
  searchParams: Promise<{ studentId?: string; status?: PaymentStatus; paymentMethod?: PaymentMethod }>;
}) {
  const ctx = await requireAuth();
  const { studentId, status, paymentMethod } = await searchParams;

  const { payments } = await PaymentDAO.listPayments(ctx, {
    studentId,
    status,
    paymentMethod
  });

  const getMethodBadge = (m: PaymentMethod) => {
    switch (m) {
      case PaymentMethod.MTN_MOMO:
        return <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 font-semibold">MTN MoMo</span>;
      case PaymentMethod.AIRTEL_MONEY:
        return <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 font-semibold">Airtel Money</span>;
      case PaymentMethod.SCHOOLPAY:
        return <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">SchoolPay</span>;
      case PaymentMethod.BANK_TRANSFER:
        return <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">Bank Slip</span>;
      case PaymentMethod.CASH:
        return <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Cash</span>;
      default:
        return <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{m}</span>;
    }
  };

  const getStatusBadge = (st: PaymentStatus) => {
    if (st === PaymentStatus.COMPLETED) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-rose-50 text-rose-700 border border-rose-200">
        <RotateCcw className="w-3 h-3" />
        Reversed
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Phase 3.1C
            </span>
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
              Cashier Journal & Receipts
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Fee Payments</h1>
          <p className="text-muted-foreground mt-1">
            Capture student fee payments, inspect FIFO allocations, issue receipts, and audit transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/finance/ledger">
            <Button variant="outline" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Student Subledger
            </Button>
          </Link>
          <Link href="/finance/payments/new">
            <Button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <Plus className="w-4 h-4" />
              Record Payment
            </Button>
          </Link>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            All Payment Transactions ({payments.length})
          </h3>
        </div>

        {payments.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h4 className="text-base font-semibold text-foreground">No payments recorded yet</h4>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Start collecting student payments with automatic FIFO invoice settlement.
            </p>
            <Link href="/finance/payments/new" className="inline-block mt-4">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Record First Payment
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold">Receipt No</TableHead>
                <TableHead className="font-semibold">Payment No</TableHead>
                <TableHead className="font-semibold">Student</TableHead>
                <TableHead className="font-semibold">Class</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Method</TableHead>
                <TableHead className="text-right font-semibold">Amount Paid</TableHead>
                <TableHead className="text-right font-semibold">Allocated</TableHead>
                <TableHead className="text-right font-semibold">Advance Credit</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-mono font-medium text-xs text-primary">
                    {p.receiptNumber}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.paymentNumber}
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.student.firstName} {p.student.lastName}
                    <span className="block text-xs font-mono text-muted-foreground">
                      {p.student.admissionNo}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.student.classRef?.name || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(p.paymentDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    })}
                  </TableCell>
                  <TableCell>
                    {getMethodBadge(p.paymentMethod)}
                    {p.externalReference && (
                      <span className="block text-[11px] font-mono text-muted-foreground truncate max-w-[120px]">
                        {p.externalReference}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    UGX {Number(p.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">
                    UGX {Number(p.allocatedAmount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {Number(p.unallocatedAmount) > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        UGX {Number(p.unallocatedAmount).toLocaleString()}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(p.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/finance/receipts/${p.id}`}>
                        <Button variant="outline" size="sm" className="h-8 gap-1">
                          <Receipt className="w-3.5 h-3.5" />
                          Receipt
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
