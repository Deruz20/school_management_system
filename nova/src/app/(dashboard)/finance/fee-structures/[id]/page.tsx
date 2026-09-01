import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";
import { db } from "@/lib/db";
import { FeeStructureDAO } from "@/lib/dao/fee-structure.dao";
import { FeeTypeDAO } from "@/lib/dao/fee-type.dao";
import FeeStructureForm from "@/components/finance/FeeStructureForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function FeeStructureDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuth();

  const [structure, classes, academicYears, feeTypes] = await Promise.all([
    FeeStructureDAO.getById(ctx, id),
    db.class.findMany({
      where: { branchId: ctx.branchId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    db.academicYear.findMany({
      where: { branchId: ctx.branchId },
      select: {
        id: true,
        name: true,
        terms: { select: { id: true, name: true }, orderBy: { startDate: 'asc' } }
      },
      orderBy: { startDate: 'desc' }
    }),
    FeeTypeDAO.list(ctx)
  ]);

  if (!structure) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/finance/fee-structures" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Finance</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Edit Fee Structure: {structure.name}
        </h1>
        <p className="text-slate-500 mt-1">
          Update fee rates, item lines, due dates, or status for this blueprint.
        </p>
      </div>

      <FeeStructureForm
        classes={classes}
        academicYears={academicYears}
        feeTypes={feeTypes}
        initialData={structure}
      />
    </div>
  );
}
