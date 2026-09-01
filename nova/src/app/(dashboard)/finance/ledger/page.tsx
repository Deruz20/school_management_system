import { requireAuth } from "@/lib/auth/require-auth";
import { db } from "@/lib/db";
import StudentLedgerView from "@/components/finance/StudentLedgerView";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function StudentLedgerPage({
  searchParams
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const ctx = await requireAuth();
  const { studentId } = await searchParams;

  const [students, academicYears] = await Promise.all([
    db.student.findMany({
      where: { branchId: ctx.branchId },
      include: { classRef: { select: { name: true } } },
      orderBy: { firstName: "asc" }
    }),
    db.academicYear.findMany({
      where: { branchId: ctx.branchId },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" }
    })
  ]);

  const studentOptions = students.map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`,
    admissionNo: s.admissionNo,
    className: s.classRef?.name || "-"
  }));

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
              Accounts Receivable Subsidiary Journal
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Student Subledger</h1>
          <p className="text-muted-foreground mt-1">
            Authoritative student debtor/credit journal, running balances, opening arrears, and financial statements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/finance/payments">
            <Button variant="outline" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              All Payments
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

      <StudentLedgerView
        students={studentOptions}
        academicYears={academicYears}
        initialStudentId={studentId}
      />
    </div>
  );
}
