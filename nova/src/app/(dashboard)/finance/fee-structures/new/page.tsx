import { requireAuth } from "@/lib/auth/require-auth";
import { db } from "@/lib/db";
import { FeeTypeDAO } from "@/lib/dao/fee-type.dao";
import FeeStructureForm from "@/components/finance/FeeStructureForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewFeeStructurePage() {
  const ctx = await requireAuth();

  const [classes, academicYears, feeTypes] = await Promise.all([
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
    FeeTypeDAO.list(ctx, { activeOnly: true })
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/finance/fee-structures" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Finance</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Fee Structure</h1>
        <p className="text-slate-500 mt-1">
          Create a class fee blueprint with itemized rates and payment deadlines.
        </p>
      </div>

      {feeTypes.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 space-y-3">
          <h2 className="font-semibold text-amber-900">No Active Fee Types Found</h2>
          <p className="text-sm">
            You must define at least one Fee Type (e.g. Tuition, Development Fee) before creating a Fee Structure.
          </p>
          <Link href="/finance/fee-types">
            <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-medium">
              Go to Fee Types Catalog
            </button>
          </Link>
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 space-y-3">
          <h2 className="font-semibold text-amber-900">No Classes Found</h2>
          <p className="text-sm">
            Please configure classes in your branch before setting up fee structures.
          </p>
        </div>
      ) : academicYears.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 space-y-3">
          <h2 className="font-semibold text-amber-900">No Academic Years Found</h2>
          <p className="text-sm">
            Please configure academic years and terms before setting up fee structures.
          </p>
        </div>
      ) : (
        <FeeStructureForm
          classes={classes}
          academicYears={academicYears}
          feeTypes={feeTypes}
        />
      )}
    </div>
  );
}
