import { requireAuth } from "@/lib/auth/require-auth";
import { db } from "@/lib/db";
import PaymentCaptureForm from "@/components/finance/PaymentCaptureForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function NewPaymentPage() {
  const ctx = await requireAuth();

  const students = await db.student.findMany({
    where: { branchId: ctx.branchId },
    include: {
      classRef: { select: { name: true } }
    },
    orderBy: { firstName: "asc" }
  });

  const studentOptions = students.map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`,
    admissionNo: s.admissionNo,
    className: s.classRef?.name || "-"
  }));

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border pb-6">
        <Link href="/finance/payments">
          <Button variant="outline" size="icon" className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Cashier Quick Pay
            </span>
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
              FIFO Allocation & Receipting
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Record Fee Payment</h1>
          <p className="text-muted-foreground mt-1">
            Collect school fees, allocate to outstanding student invoices, and issue an official receipt.
          </p>
        </div>
      </div>

      {/* Interactive Form */}
      <PaymentCaptureForm students={studentOptions} />
    </div>
  );
}
