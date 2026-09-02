'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BudgetRevisionModal } from '@/components/finance/BudgetRevisionModal';

interface BudgetItemDetail {
  id: string;
  code: string;
  name: string;
  type: 'EXPENSE_VOTE_HEAD' | 'REVENUE_TARGET';
  categoryId?: string | null;
  feeTypeId?: string | null;
  allocatedAmount: string;
  notes?: string | null;
  category?: { name: string; code: string } | null;
  feeType?: { name: string; code: string } | null;
}

interface BudgetRevisionDetail {
  id: string;
  revisionNumber: number;
  title: string;
  reason: string;
  status: 'DRAFT' | 'APPROVED' | 'REJECTED';
  totalDelta: string;
  preparedBy: { id: string; firstName: string; lastName: string };
  authorizedBy: { id: string; firstName: string; lastName: string } | null;
  preparedAt: string;
  authorizedAt: string | null;
  items: Array<{
    id: string;
    previousAmount: string;
    deltaAmount: string;
    newAmount: string;
    budgetItem: { name: string; code: string };
  }>;
}

interface BudgetDetail {
  id: string;
  budgetNumber: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CLOSED';
  totalExpense: string;
  totalIncome: string;
  netSurplus: string;
  rejectionReason: string | null;
  academicYear: { id: string; name: string };
  term: { id: string; name: string } | null;
  createdBy: { id: string; firstName: string; lastName: string; email: string | null };
  submittedBy: { id: string; firstName: string; lastName: string; email: string | null } | null;
  approvedBy: { id: string; firstName: string; lastName: string; email: string | null } | null;
  items: BudgetItemDetail[];
  revisions: BudgetRevisionDetail[];
}

interface VarianceItem {
  id: string;
  code: string;
  name: string;
  categoryName: string;
  allocatedAmount: string;
  actualSpent: string;
  variance: string;
  utilizationPercent: number;
  status: 'HEALTHY' | 'WARNING' | 'OVER_BUDGET';
}

interface RevenueItem {
  id: string;
  code: string;
  name: string;
  feeTypeName: string;
  targetAmount: string;
  actualInvoiced: string;
  shortfall: string;
  realizationPercent: number;
}

interface VarianceResponse {
  variance: {
    summary: {
      totalAllocatedExpense: string;
      totalActualExpenditure: string;
      totalExpenditureVariance: string;
      totalUtilizationPercent: number;
      isOverBudget: boolean;
    };
    items: VarianceItem[];
  };
  revenue: {
    summary: {
      totalTargetIncome: string;
      totalInvoicedRevenue: string;
      totalCollectedCash: string;
      totalShortfall: string;
      overallRealizationPercent: number;
    };
    items: RevenueItem[];
  };
}

export default function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [budget, setBudget] = useState<BudgetDetail | null>(null);
  const [varianceData, setVarianceData] = useState<VarianceResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'variance' | 'revenue' | 'revisions'>('variance');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [budgetRes, varRes] = await Promise.all([
          fetch(`/api/budgets/${id}`),
          fetch(`/api/budgets/${id}/variance`),
        ]);

        if (!budgetRes.ok) throw new Error(await budgetRes.text());
        const bData = await budgetRes.json();
        const vData = varRes.ok ? await varRes.json() : null;

        if (!ignore) {
          setBudget(bData.budget);
          setVarianceData(vData);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError((err as Error).message || 'Failed to load budget');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [id, refreshCount]);

  const handleSubmitBudget = async () => {
    setIsActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/budgets/${id}/submit`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      setRefreshCount((c) => c + 1);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApproveBudget = async () => {
    setIsActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/budgets/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowSingleAdminMode: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      setRefreshCount((c) => c + 1);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectBudget = async () => {
    if (!rejectReason.trim()) {
      setError('Please specify a rejection reason.');
      return;
    }
    setIsActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/budgets/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowRejectModal(false);
      setRejectReason('');
      setRefreshCount((c) => c + 1);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApproveRevision = async (revisionId: string) => {
    setIsActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/budgets/${id}/revisions/${revisionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowSingleAdminMode: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      setRefreshCount((c) => c + 1);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!confirm('Are you sure you want to delete this draft budget?')) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      router.push('/finance/budgets');
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading budget workstation...</div>;
  }

  if (!budget) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-gray-700">Budget not found.</p>
        <Link href="/finance/budgets" className="text-emerald-600 font-semibold hover:underline">
          ← Back to Budgets
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
    SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
    CLOSED: 'bg-gray-50 text-gray-500 border-gray-200',
  };

  const expenseSummary = varianceData?.variance?.summary;
  const revenueSummary = varianceData?.revenue?.summary;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              href="/finance/budgets"
              className="text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              ← Budgets
            </Link>
            <span className="text-gray-300">•</span>
            <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
              {budget.budgetNumber}
            </span>
            <span
              data-testid="budget-status-badge"
              className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                statusColors[budget.status] || 'bg-gray-100 text-gray-600'
              }`}
            >
              {budget.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{budget.title}</h1>
          <p className="text-xs text-gray-500">
            {budget.academicYear.name} {budget.term ? `• ${budget.term.name}` : '• Full Academic Year'}
            {budget.submittedBy && ` • Submitted by ${budget.submittedBy.firstName} ${budget.submittedBy.lastName}`}
            {budget.approvedBy && ` • Approved by ${budget.approvedBy.firstName} ${budget.approvedBy.lastName}`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {budget.status === 'DRAFT' && (
            <>
              <button
                onClick={handleDeleteDraft}
                disabled={isActionLoading}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
              >
                Delete Draft
              </button>
              <button
                onClick={handleSubmitBudget}
                disabled={isActionLoading}
                data-testid="submit-budget-btn"
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
              >
                Submit for Approval →
              </button>
            </>
          )}

          {budget.status === 'SUBMITTED' && (
            <>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={isActionLoading}
                data-testid="reject-budget-btn"
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-white border border-rose-300 hover:bg-rose-50 rounded-lg transition"
              >
                Reject / Return
              </button>
              <button
                onClick={handleApproveBudget}
                disabled={isActionLoading}
                data-testid="approve-budget-btn"
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
              >
                ✓ Board Approve Budget
              </button>
            </>
          )}

          {budget.status === 'APPROVED' && (
            <>
              <a
                href={`/api/budgets/${id}/export`}
                target="_blank"
                rel="noreferrer"
                data-testid="export-budget-csv-btn"
                className="px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition flex items-center gap-1.5"
              >
                <span>↓</span> Export Variance CSV
              </a>
              <button
                onClick={() => setIsRevisionModalOpen(true)}
                data-testid="create-revision-btn"
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
              >
                + Supplementary Revision
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {budget.rejectionReason && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
          <strong>Rejection Notes:</strong> {budget.rejectionReason}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Authorized Expense
          </div>
          <div className="mt-2 text-xl font-bold text-gray-900 font-mono">
            UGX {parseFloat(budget.totalExpense).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {expenseSummary
              ? `Spent: UGX ${parseFloat(expenseSummary.totalActualExpenditure).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : 'Approved expenditure ceiling'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Remaining Expense Variance
          </div>
          <div
            className={`mt-2 text-xl font-bold font-mono ${
              expenseSummary && parseFloat(expenseSummary.totalExpenditureVariance) < 0
                ? 'text-rose-600'
                : 'text-emerald-600'
            }`}
          >
            {expenseSummary
              ? `UGX ${parseFloat(expenseSummary.totalExpenditureVariance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : 'N/A'}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {expenseSummary ? `${expenseSummary.totalUtilizationPercent}% budget consumed` : 'Awaiting actuals'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Target Fee Revenue
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-700 font-mono">
            UGX {parseFloat(budget.totalIncome).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {revenueSummary
              ? `Collected: UGX ${parseFloat(revenueSummary.totalCollectedCash).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : 'Target billing projection'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Planned Net Surplus
          </div>
          <div
            className={`mt-2 text-xl font-bold font-mono ${
              parseFloat(budget.netSurplus) >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            UGX {parseFloat(budget.netSurplus).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {parseFloat(budget.netSurplus) >= 0 ? 'Surplus Projection' : 'Deficit Projection'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('variance')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'variance'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Expenditure Variance ({budget.items.filter((i) => i.type === 'EXPENSE_VOTE_HEAD').length} Vote Heads)
          </button>
          <button
            onClick={() => setActiveTab('revenue')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'revenue'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Revenue Realization ({budget.items.filter((i) => i.type === 'REVENUE_TARGET').length} Streams)
          </button>
          <button
            onClick={() => setActiveTab('revisions')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'revisions'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Revisions History ({budget.revisions.length})
          </button>
        </nav>
      </div>

      {/* Tab 1: Live Expenditure Variance */}
      {activeTab === 'variance' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Vote Head</th>
                  <th className="py-3 px-4 text-right">Allocated Budget</th>
                  <th className="py-3 px-4 text-right">Actual Spent</th>
                  <th className="py-3 px-4 text-right">Remaining Variance</th>
                  <th className="py-3 px-4 w-48 text-center">Utilization</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {varianceData?.variance?.items?.map((item) => {
                  const statusBadges: Record<string, string> = {
                    HEALTHY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
                    OVER_BUDGET: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
                  };

                  return (
                    <tr
                      key={item.id}
                      data-testid={`variance-row-${item.code}`}
                      className="hover:bg-gray-50/80 transition"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{item.code}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-gray-900">
                        UGX {parseFloat(item.allocatedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">
                        UGX {parseFloat(item.actualSpent).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold ${
                          parseFloat(item.variance) < 0 ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        UGX {parseFloat(item.variance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                item.utilizationPercent > 100
                                  ? 'bg-rose-500'
                                  : item.utilizationPercent >= 80
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, item.utilizationPercent)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gray-600 w-12 text-right">
                            {item.utilizationPercent}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[11px] rounded-full border ${
                            statusBadges[item.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Revenue Realization */}
      {activeTab === 'revenue' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Revenue Stream</th>
                  <th className="py-3 px-4 text-right">Target Amount</th>
                  <th className="py-3 px-4 text-right">Actual Invoiced</th>
                  <th className="py-3 px-4 text-right">Shortfall</th>
                  <th className="py-3 px-4 w-48 text-center">Realization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {varianceData?.revenue?.items?.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{item.code}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-800">
                      UGX {parseFloat(item.targetAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-800">
                      UGX {parseFloat(item.actualInvoiced).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        parseFloat(item.shortfall) > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      UGX {parseFloat(item.shortfall).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, item.realizationPercent)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-600 w-12 text-right">
                          {item.realizationPercent}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Revisions History */}
      {activeTab === 'revisions' && (
        <div className="space-y-4">
          {budget.revisions.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500 text-sm">
              No supplementary revisions have been created for this budget.
            </div>
          ) : (
            budget.revisions.map((rev) => (
              <div
                key={rev.id}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      Revision #{rev.revisionNumber}
                    </span>
                    <h3 className="text-base font-bold text-gray-900">{rev.title}</h3>
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        rev.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : rev.status === 'DRAFT'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {rev.status}
                    </span>
                  </div>

                  {rev.status === 'DRAFT' && (
                    <button
                      onClick={() => handleApproveRevision(rev.id)}
                      disabled={isActionLoading}
                      className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
                    >
                      ✓ Authorize Revision
                    </button>
                  )}
                </div>

                <p className="text-xs text-gray-600">
                  <strong>Authority Reason:</strong> {rev.reason}
                </p>

                <div className="text-xs text-gray-400">
                  Prepared by {rev.preparedBy.firstName} {rev.preparedBy.lastName} on{' '}
                  {new Date(rev.preparedAt).toLocaleDateString()}
                  {rev.authorizedBy && (
                    <>
                      {' '}
                      • Authorized by {rev.authorizedBy.firstName} {rev.authorizedBy.lastName} on{' '}
                      {rev.authorizedAt ? new Date(rev.authorizedAt).toLocaleDateString() : ''}
                    </>
                  )}
                </div>

                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
                      <tr>
                        <th className="py-2 px-3">Vote Head</th>
                        <th className="py-2 px-3 text-right">Previous (UGX)</th>
                        <th className="py-2 px-3 text-right">Adjustment (+/-)</th>
                        <th className="py-2 px-3 text-right">Revised Budget</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rev.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 px-3 font-medium text-gray-900">
                            {item.budgetItem.name}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-gray-600">
                            {parseFloat(item.previousAmount).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono font-bold ${
                              parseFloat(item.deltaAmount) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {parseFloat(item.deltaAmount) >= 0 ? '+' : ''}
                            {parseFloat(item.deltaAmount).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                            {parseFloat(item.newAmount).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Revision Preparation Modal */}
      <BudgetRevisionModal
        budgetId={budget.id}
        items={budget.items}
        isOpen={isRevisionModalOpen}
        onClose={() => setIsRevisionModalOpen(false)}
        onSuccess={() => setRefreshCount((c) => c + 1)}
      />

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reject / Return Budget</h3>
            <p className="text-xs text-gray-500">
              Provide specific feedback notes to return this budget to draft for corrections.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Science laboratory vote head exceeds board policy by 20%."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
              required
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectBudget}
                disabled={isActionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
