import { requireAuth } from "@/lib/auth/require-auth";
import { GuardianDAO } from "@/lib/dao/guardian.dao";
import { GuardiansTable } from "./guardians-table";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function GuardiansPage({
  searchParams
}: {
  searchParams: Promise<{ search?: string; isVerified?: string }>
}) {
  const ctx = await requireAuth();
  const params = await searchParams;

  const isVerified = params.isVerified !== undefined ? params.isVerified === "true" : undefined;
  const { total, items: guardians } = await GuardianDAO.listGuardians(ctx, {
    search: params.search,
    isVerified,
    take: 100
  });

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admissions" className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
              <ArrowLeft size={14} />
              <span>Back to Admissions</span>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Guardian KYC & Family Directory</h1>
          <p className="text-slate-500 mt-1">
            Master directory of student guardians, family household grouping, and formal identity verification status.
          </p>
        </div>
      </div>

      <GuardiansTable guardians={guardians} total={total} />
    </div>
  );
}
