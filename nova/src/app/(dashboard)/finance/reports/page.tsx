import { requireAuth } from "@/lib/auth/require-auth";
import { FinancialReportDAO } from "@/lib/dao/financial-report.dao";
import { db } from "@/lib/db";
import FinancialReportsDashboard from "@/components/finance/FinancialReportsDashboard";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

export default async function FinancialReportsPage({
  searchParams
}: {
  searchParams: Promise<{ academicYearId?: string; termId?: string }>;
}) {
  const ctx = await requireAuth();
  const { academicYearId, termId } = await searchParams;

  const [
    academicYears,
    terms,
    classes,
    branchSettings
  ] = await Promise.all([
    db.academicYear.findMany({
      where: { branchId: ctx.branchId },
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true }
    }),
    db.term.findMany({
      where: { academicYear: { branchId: ctx.branchId } },
      orderBy: { startDate: 'asc' },
      select: { id: true, name: true, academicYearId: true }
    }),
    db.class.findMany({
      where: { branchId: ctx.branchId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
    db.branchSettings.findUnique({
      where: { branchId: ctx.branchId },
      select: { activeAcademicYearId: true, activeTermId: true }
    })
  ]);

  const activeYearId = academicYearId || branchSettings?.activeAcademicYearId || academicYears[0]?.id || undefined;
  const activeTermId = termId || (academicYearId ? undefined : (branchSettings?.activeTermId || undefined));

  const [
    summary,
    classCollection,
    termCollection,
    cashFlow,
    paymentChannels,
    debtorsRes
  ] = await Promise.all([
    FinancialReportDAO.getExecutiveSummary(ctx, {
      academicYearId: activeYearId,
      termId: activeTermId
    }),
    FinancialReportDAO.getCollectionByClass(ctx, {
      academicYearId: activeYearId,
      termId: activeTermId
    }),
    FinancialReportDAO.getCollectionByTerm(ctx, {
      academicYearId: activeYearId
    }),
    FinancialReportDAO.get12MonthCashFlow(ctx),
    FinancialReportDAO.getPaymentChannels(ctx, {
      academicYearId: activeYearId,
      termId: activeTermId
    }),
    FinancialReportDAO.getDebtorsReport(ctx, { limit: 20 })
  ]);

  const formattedSummary = {
    accrual: {
      invoiceCount: summary.accrual.invoiceCount,
      grossBilled: summary.accrual.grossBilled.toString(),
      discountAmount: summary.accrual.discountAmount.toString(),
      netBilled: summary.accrual.netBilled.toString(),
      termCollected: summary.accrual.termCollected.toString(),
      outstanding: summary.accrual.outstanding.toString(),
      collectionRate: summary.accrual.collectionRate
    },
    cashFlow: {
      feePaymentCount: summary.cashFlow.feePaymentCount,
      totalFeeInflows: summary.cashFlow.totalFeeInflows.toString(),
      expenseCount: summary.cashFlow.expenseCount,
      totalOperationalExpenses: summary.cashFlow.totalOperationalExpenses.toString(),
      netOperatingCashFlow: summary.cashFlow.netOperatingCashFlow.toString()
    }
  };

  const formattedClassCollection = classCollection.map((c) => ({
    classId: c.classId,
    className: c.className,
    studentCount: c.studentCount,
    invoiceCount: c.invoiceCount,
    grossBilled: c.grossBilled.toString(),
    discountAmount: c.discountAmount.toString(),
    netBilled: c.netBilled.toString(),
    collected: c.collected.toString(),
    outstanding: c.outstanding.toString(),
    collectionRate: c.collectionRate
  }));

  const formattedTermCollection = termCollection.map((t) => ({
    termId: t.termId,
    termName: t.termName,
    studentCount: t.studentCount,
    invoiceCount: t.invoiceCount,
    grossBilled: t.grossBilled.toString(),
    discountAmount: t.discountAmount.toString(),
    netBilled: t.netBilled.toString(),
    collected: t.collected.toString(),
    outstanding: t.outstanding.toString(),
    collectionRate: t.collectionRate
  }));

  const formattedCashFlow = cashFlow.map((m) => ({
    key: m.key,
    label: m.label,
    shortMonth: m.shortMonth,
    year: m.year,
    feesIn: m.feesIn.toString(),
    expensesOut: m.expensesOut.toString(),
    netCashFlow: m.netCashFlow.toString()
  }));

  const formattedPaymentChannels = {
    totalTransactions: paymentChannels.totalTransactions,
    totalVolume: paymentChannels.totalVolume.toString(),
    channels: paymentChannels.channels.map((c) => ({
      method: c.method,
      count: c.count,
      totalAmount: c.totalAmount.toString(),
      percentage: c.percentage
    }))
  };

  const formattedDebtors = debtorsRes.debtors.map((d) => ({
    studentId: d.studentId,
    admissionNo: d.admissionNo,
    fullName: d.fullName,
    className: d.className,
    streamName: d.streamName,
    balance: d.balance.toString(),
    totalDebits: d.totalDebits.toString(),
    totalCredits: d.totalCredits.toString(),
    lastPaymentDate: d.lastPaymentDate ? d.lastPaymentDate.toISOString() : null
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/finance" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Finance</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Executive Financial Reports & Analytics</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Real-time collection rates, class billing summaries, 12-month net cash flow, and debtor management.
              </p>
            </div>
          </div>
        </div>
      </div>

      <FinancialReportsDashboard
        initialSummary={formattedSummary}
        initialClassCollection={formattedClassCollection}
        initialTermCollection={formattedTermCollection}
        initialCashFlow={formattedCashFlow}
        initialPaymentChannels={formattedPaymentChannels}
        initialDebtors={formattedDebtors}
        totalDebtors={debtorsRes.summary.totalDebtors}
        totalDebtAmount={debtorsRes.summary.totalDebtAmount.toString()}
        academicYears={academicYears}
        terms={terms}
        classes={classes}
        currentYearId={activeYearId}
        currentTermId={activeTermId}
      />
    </div>
  );
}
