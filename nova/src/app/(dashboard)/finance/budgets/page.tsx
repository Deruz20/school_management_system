'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface BudgetListItem {
  id: string;
  budgetNumber: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CLOSED';
  totalExpense: string;
  totalIncome: string;
  netSurplus: string;
  academicYear: {
    id: string;
    name: string;
  };
  term: {
    id: string;
    name: string;
  } | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  approvedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  _count: {
    items: number;
    revisions: number;
  };
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function loadBudgets() {
      setIsLoading(true);
      setError(null);
      try {
        const url = statusFilter === 'ALL' ? '/api/budgets' : `/api/budgets?status=${statusFilter}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!ignore) {
          setBudgets(data.budgets || []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError((err as Error).message || 'Failed to load budgets');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }
    loadBudgets();
    return () => {
      ignore = true;
    };
  }, [statusFilter, refreshIndex]);

  const activeBudget = budgets.find((b) => b.status === 'APPROVED');
  const totalAllocated = budgets
    .filter((b) => b.status === 'APPROVED')
    .reduce((acc, b) => acc + parseFloat(b.totalExpense), 0);
  const totalRevenue = budgets
    .filter((b) => b.status === 'APPROVED')
    .reduce((acc, b) => acc + parseFloat(b.totalIncome), 0);
  const netProjected = totalRevenue - totalAllocated;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            School Budgeting &amp; Vote Heads
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enterprise annual and termly expenditure budgets, vote head ceilings, and live variance control.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/finance"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            ← Finance Hub
          </Link>
          <Link
            href="/finance/budgets/new"
            data-testid="create-budget-btn"
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition flex items-center gap-2"
          >
            <span>+</span> Create New Budget
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Active Approved Budget
          </div>
          <div className="mt-2 text-xl font-bold text-gray-900">
            {activeBudget ? activeBudget.budgetNumber : 'None Active'}
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {activeBudget ? `${activeBudget.academicYear.name} ${activeBudget.term ? `• ${activeBudget.term.name}` : '(Annual)'}` : 'Create & approve a budget'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Authorized Expenditure
          </div>
          <div className="mt-2 text-xl font-bold text-gray-900">
            UGX {totalAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Across active approved budgets
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Projected Revenue Target
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-700">
            UGX {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Fee realization projections
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Planned Net Surplus
          </div>
          <div className={`mt-2 text-xl font-bold ${netProjected >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            UGX {netProjected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {netProjected >= 0 ? 'Surplus Projection' : 'Deficit Projection'}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status:</span>
          {['ALL', 'APPROVED', 'SUBMITTED', 'DRAFT', 'REJECTED', 'CLOSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <button
          onClick={() => setRefreshIndex((prev) => prev + 1)}
          className="text-xs text-gray-500 hover:text-gray-800 font-medium px-2 py-1 border border-gray-200 rounded hover:bg-gray-50"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Budget List Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading school budgets...</div>
        ) : budgets.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="text-3xl">📊</div>
            <p className="text-base font-semibold text-gray-900">No Budgets Found</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              No school operating budgets match the selected status filter. Click below to draft an annual or termly budget.
            </p>
            <Link
              href="/finance/budgets/new"
              className="inline-block px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition shadow-sm"
            >
              + Create Budget
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Budget #</th>
                  <th className="py-3 px-4">Title &amp; Academic Period</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Expense Budget</th>
                  <th className="py-3 px-4 text-right">Revenue Target</th>
                  <th className="py-3 px-4 text-right">Net Surplus</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {budgets.map((b) => {
                  const statusColors: Record<string, string> = {
                    DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
                    SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
                    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
                    CLOSED: 'bg-gray-50 text-gray-500 border-gray-200',
                  };

                  return (
                    <tr
                      key={b.id}
                      data-testid={`budget-row-${b.id}`}
                      className="hover:bg-gray-50/80 transition"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-gray-900 text-xs">
                        {b.budgetNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{b.title}</div>
                        <div className="text-xs text-gray-500">
                          {b.academicYear.name} {b.term ? `• ${b.term.name}` : '• Full Year (Annual)'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${
                            statusColors[b.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        UGX {parseFloat(b.totalExpense).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-700">
                        UGX {parseFloat(b.totalIncome).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-800">
                        UGX {parseFloat(b.netSurplus).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-gray-500">
                        {b._count.items} heads {b._count.revisions > 0 && `(${b._count.revisions} rev)`}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/finance/budgets/${b.id}`}
                          className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                        >
                          View Workstation →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
