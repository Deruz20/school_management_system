import { requireAuth } from "@/lib/auth/require-auth";
import { FeeStructureDAO } from "@/lib/dao/fee-structure.dao";
import { FeeTypeDAO } from "@/lib/dao/fee-type.dao";
import { db } from "@/lib/db";
import IndividualInvoiceForm from "@/components/finance/IndividualInvoiceForm";

export default async function NewInvoicePage() {
  const ctx = await requireAuth();

  const [students, feeTypes, academicYears, feeStructures] = await Promise.all([
    db.student.findMany({
      where: { branchId: ctx.branchId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            classRef: { select: { name: true } },
            academicYear: { select: { name: true } }
          }
        }
      },
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
    }),
    FeeStructureDAO.list(ctx)
  ]);

  const studentOptions = students.map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`,
    admissionNo: s.admissionNo,
    enrollments: s.enrollments.map((e) => ({
      id: e.id,
      classId: e.classId,
      academicYearId: e.academicYearId,
      className: e.classRef.name,
      yearName: e.academicYear.name
    }))
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

  const feeStructureOptions = feeStructures.map((fs) => ({
    id: fs.id,
    name: fs.name,
    classId: fs.classId,
    academicYearId: fs.academicYearId,
    termId: fs.termId
  }));

  return (
    <IndividualInvoiceForm
      students={studentOptions}
      feeTypes={feeTypeOptions}
      academicYears={academicYearOptions}
      feeStructures={feeStructureOptions}
    />
  );
}
