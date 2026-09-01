import { requireAuth } from "@/lib/auth/require-auth";
import { DiscountDAO } from "@/lib/dao/discount.dao";
import { FeeTypeDAO } from "@/lib/dao/fee-type.dao";
import { db } from "@/lib/db";
import DiscountList from "@/components/finance/DiscountList";

export default async function DiscountsPage() {
  const ctx = await requireAuth();

  const [discounts, students, feeTypes, academicYears] = await Promise.all([
    DiscountDAO.list(ctx),
    db.student.findMany({
      where: { branchId: ctx.branchId },
      select: { id: true, firstName: true, lastName: true, admissionNo: true },
      orderBy: { firstName: 'asc' }
    }),
    FeeTypeDAO.list(ctx),
    db.academicYear.findMany({
      where: { branchId: ctx.branchId },
      include: {
        terms: {
          select: { id: true, name: true },
          orderBy: { startDate: 'asc' }
        }
      },
      orderBy: { startDate: 'desc' }
    })
  ]);

  const studentOptions = students.map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`,
    admissionNo: s.admissionNo
  }));

  const feeTypeOptions = feeTypes.map((ft) => ({
    id: ft.id,
    name: ft.name,
    code: ft.code
  }));

  const academicYearOptions = academicYears.map((ay) => ({
    id: ay.id,
    name: ay.name,
    terms: ay.terms
  }));

  return (
    <DiscountList
      initialDiscounts={discounts}
      students={studentOptions}
      feeTypes={feeTypeOptions}
      academicYears={academicYearOptions}
    />
  );
}
