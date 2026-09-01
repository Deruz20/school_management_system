import { requireAuth } from "@/lib/auth/require-auth";
import { FeeTypeDAO } from "@/lib/dao/fee-type.dao";
import FeeTypeList from "@/components/finance/FeeTypeList";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function FeeTypesPage() {
  const ctx = await requireAuth();
  const feeTypes = await FeeTypeDAO.list(ctx);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/finance" className="text-slate-400 hover:text-slate-600">
              <ArrowLeft size={16} />
            </Link>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Finance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fee Types Catalog</h1>
          <p className="text-slate-500 mt-1">
            Configure standard fee categories and codes used across fee structures.
          </p>
        </div>
      </div>

      <FeeTypeList initialFeeTypes={feeTypes} />
    </div>
  );
}
