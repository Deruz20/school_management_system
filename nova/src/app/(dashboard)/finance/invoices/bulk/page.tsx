import { requireAuth } from "@/lib/auth/require-auth";
import { FeeStructureDAO } from "@/lib/dao/fee-structure.dao";
import { db } from "@/lib/db";
import BulkInvoiceForm from "@/components/finance/BulkInvoiceForm";

export default async function BulkInvoicesPage() {
  const ctx = await requireAuth();

  const [classes, academicYears, feeStructures] = await Promise.all([
    db.class.findMany({
      where: { branchId: ctx.branchId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    db.academicYear.findMany({
      where: { branchId: ctx.branchId },
      include: {
        terms: {
          select: { id: true, name: true },
          orderBy: { startDate: 'asc' }
        }
      },
      orderBy: { startDate: 'desc' }
    }),
    FeeStructureDAO.list(ctx)
  ]);

  const classOptions = classes.map((c) => ({ id: c.id, name: c.name }));
  const academicYearOptions = academicYears.map((ay) => ({
    id: ay.id,
    name: ay.name,
    terms: ay.terms
  }));

  const feeStructureOptions = feeStructures.map((fs) => ({
    id: fs.id,
    name: fs.name,
    classId: fs.classId,
    academicYearId: fs.academicYearId,
    termId: fs.termId,
    items: fs.items.map((i) => ({
      id: i.id,
      feeTypeId: i.feeTypeId,
      amount: i.amount,
      feeType: { name: i.feeType.name, code: i.feeType.code }
    }))
  }));

  return (
    <BulkInvoiceForm
      classes={classOptions}
      academicYears={academicYearOptions}
      feeStructures={feeStructureOptions}
    />
  );
}
