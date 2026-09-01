import { requireAuth } from "@/lib/auth/require-auth";
import { PaymentDAO } from "@/lib/dao/payment.dao";
import ReceiptDocument from "@/components/finance/ReceiptDocument";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ReceiptDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAuth();
  const { id } = await params;

  const data = await PaymentDAO.getReceipt(ctx, id);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top back navigation (Hidden when printing) */}
      <div className="print:hidden flex items-center gap-4">
        <Link href="/finance/payments">
          <Button variant="outline" size="icon" className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Receipt #{data.receipt.receiptNumber}</h2>
          <p className="text-xs text-muted-foreground">Official School Payment Receipt</p>
        </div>
      </div>

      <ReceiptDocument
        receipt={{
          ...data.receipt,
          issuedAt: data.receipt.issuedAt.toISOString(),
          voidedAt: data.receipt.voidedAt ? data.receipt.voidedAt.toISOString() : null,
          amountFigures: data.receipt.amountFigures.toString()
        }}
        school={data.school}
        student={data.student}
        settlementBreakdown={data.settlementBreakdown.map((s) => ({
          invoiceNumber: s.invoiceNumber,
          allocatedAmount: s.allocatedAmount.toString(),
          invoiceNetAmount: s.invoiceNetAmount.toString(),
          dueDate: s.dueDate.toISOString()
        }))}
        accountSummary={{
          currentStudentBalance: data.accountSummary.currentStudentBalance.toString(),
          totalBilledToDate: data.accountSummary.totalBilledToDate.toString(),
          totalPaidToDate: data.accountSummary.totalPaidToDate.toString()
        }}
        paymentId={id}
      />
    </div>
  );
}
