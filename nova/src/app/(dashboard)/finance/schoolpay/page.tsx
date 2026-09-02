import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/require-auth';
import { SchoolPayConfigDAO } from '@/lib/dao/schoolpay-config.dao';
import { SchoolPayDAO } from '@/lib/dao/schoolpay.dao';
import SchoolPayConfigAccordion from '@/components/finance/SchoolPayConfigAccordion';
import SchoolPayReconciliationTable from '@/components/finance/SchoolPayReconciliationTable';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SchoolPay Uganda Reconciliation | NOVA Finance',
  description: 'Automated gateway reconciliation and student fee settlement for SchoolPay Uganda',
};

export default async function SchoolPayPage() {
  const ctx = await requireAuth();

  const [config, txResult, stats] = await Promise.all([
    SchoolPayConfigDAO.getConfig(ctx),
    SchoolPayDAO.getTransactions(ctx, { page: 1, limit: 25 }),
    SchoolPayDAO.getStats(ctx)
  ]);

  const serializedConfig = config ? {
    ...config,
    lastSyncedAt: config.lastSyncedAt ? config.lastSyncedAt.toISOString() : null
  } : null;

  const serializedTransactions = txResult.transactions.map((t) => ({
    id: t.id,
    schoolPayReceiptNo: t.schoolPayReceiptNo,
    transactionId: t.transactionId,
    schoolPayCode: t.schoolPayCode,
    amount: t.amount.toString(),
    feeAmount: t.feeAmount ? t.feeAmount.toString() : null,
    payerName: t.payerName,
    payerPhone: t.payerPhone,
    channel: t.channel,
    paymentDate: t.paymentDate.toISOString(),
    status: t.status,
    errorMessage: t.errorMessage,
    reviewNotes: t.reviewNotes,
    student: t.student ? {
      id: t.student.id,
      firstName: t.student.firstName,
      lastName: t.student.lastName,
      admissionNo: t.student.admissionNo,
      classRef: t.student.classRef || undefined,
      streamRef: t.student.streamRef || undefined
    } : null,
    payment: t.payment ? {
      id: t.payment.id,
      paymentNumber: t.payment.paymentNumber,
      receipt: t.payment.receipt ? { receiptNumber: t.payment.receipt.receiptNumber } : null
    } : null,
    rawPayload: t.rawPayload as Record<string, unknown> | null
  }));

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Gateway Ingestion
            </span>
            <span className="text-xs text-slate-500 font-medium">Phase 3.1E</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            SchoolPay Uganda Reconciliation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time webhook ingestion, deterministic student matching, and automated FIFO ledger settlement
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/finance"
            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm transition-all"
          >
            ← Back to Finance Hub
          </Link>
        </div>
      </div>

      {/* 1. Connection Settings Accordion */}
      <SchoolPayConfigAccordion
        initialConfig={serializedConfig}
      />

      {/* 2. Reconciliation Table & Operations */}
      <SchoolPayReconciliationTable
        initialTransactions={serializedTransactions}
        initialStats={stats}
        initialTotal={txResult.total}
      />
    </div>
  );
}
