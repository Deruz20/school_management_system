'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AcademicYearOption {
  id: string;
  name: string;
  terms: Array<{ id: string; name: string }>;
}

interface ExpenseCategoryOption {
  id: string;
  name: string;
  code: string;
}

interface FeeTypeOption {
  id: string;
  name: string;
  code: string;
}

interface VoteHeadRow {
  categoryId: string;
  code: string;
  name: string;
  amount: string;
  notes: string;
}

interface RevenueTargetRow {
  feeTypeId: string;
  code: string;
  name: string;
  amount: string;
  notes: string;
}

export default function NewBudgetPage() {
  const router = useRouter();

  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [isAnnual, setIsAnnual] = useState<boolean>(true);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const [voteHeads, setVoteHeads] = useState<VoteHeadRow[]>([]);
  const [revenueTargets, setRevenueTargets] = useState<RevenueTargetRow[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [yearRes, catRes, feeRes] = await Promise.all([
          fetch('/api/academic-years'),
          fetch('/api/expense-categories'),
          fetch('/api/fee-types'),
        ]);

        if (!yearRes.ok) throw new Error('Failed to load academic years');
        if (!catRes.ok) throw new Error('Failed to load expense categories');
        if (!feeRes.ok) throw new Error('Failed to load fee types');

        const yearData = await yearRes.json();
        const catData = await catRes.json();
        const feeData = await feeRes.json();

        if (!ignore) {
          const years: AcademicYearOption[] = yearData.academicYears || [];
          setAcademicYears(years);
          if (years.length > 0) {
            setSelectedYearId(yearData.activeAcademicYearId || years[0].id);
            setTitle(`${years[0].name} Annual Operating Budget`);
          }

          const categories: ExpenseCategoryOption[] = catData.categories || catData || [];
          setVoteHeads(
            categories.map((c) => ({
              categoryId: c.id,
              code: c.code,
              name: c.name,
              amount: '0',
              notes: '',
            }))
          );

          const feeTypes: FeeTypeOption[] = feeData.feeTypes || feeData || [];
          setRevenueTargets(
            feeTypes.map((f) => ({
              feeTypeId: f.id,
              code: f.code,
              name: f.name,
              amount: '0',
              notes: '',
            }))
          );
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError((err as Error).message);
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
  }, []);

  const currentYear = academicYears.find((y) => y.id === selectedYearId);

  const handleYearChange = (yearId: string) => {
    setSelectedYearId(yearId);
    const yr = academicYears.find((y) => y.id === yearId);
    if (yr) {
      setTitle(`${yr.name} ${isAnnual ? 'Annual' : 'Termly'} Operating Budget`);
    }
  };

  const handleAnnualToggle = (annual: boolean) => {
    setIsAnnual(annual);
    if (annual) {
      setSelectedTermId('');
      if (currentYear) setTitle(`${currentYear.name} Annual Operating Budget`);
    } else {
      if (currentYear && currentYear.terms.length > 0) {
        setSelectedTermId(currentYear.terms[0].id);
        setTitle(`${currentYear.name} ${currentYear.terms[0].name} Operating Budget`);
      }
    }
  };

  const updateVoteHeadAmount = (index: number, amount: string) => {
    setVoteHeads((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], amount };
      return next;
    });
  };

  const updateVoteHeadNotes = (index: number, notes: string) => {
    setVoteHeads((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], notes };
      return next;
    });
  };

  const updateRevenueAmount = (index: number, amount: string) => {
    setRevenueTargets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], amount };
      return next;
    });
  };

  const totalExpense = voteHeads.reduce((acc, h) => {
    const val = parseFloat(h.amount);
    return acc + (isNaN(val) || val < 0 ? 0 : val);
  }, 0);

  const totalIncome = revenueTargets.reduce((acc, r) => {
    const val = parseFloat(r.amount);
    return acc + (isNaN(val) || val < 0 ? 0 : val);
  }, 0);

  const netSurplus = totalIncome - totalExpense;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYearId) {
      setError('Please select an Academic Year.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a budget title.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const items = [
      ...voteHeads.map((vh) => ({
        type: 'EXPENSE_VOTE_HEAD',
        categoryId: vh.categoryId,
        code: vh.code,
        name: vh.name,
        allocatedAmount: parseFloat(vh.amount) || 0,
        notes: vh.notes || undefined,
      })),
      ...revenueTargets.map((rt) => ({
        type: 'REVENUE_TARGET',
        feeTypeId: rt.feeTypeId,
        code: rt.code,
        name: rt.name,
        allocatedAmount: parseFloat(rt.amount) || 0,
        notes: rt.notes || undefined,
      })),
    ];

    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicYearId: selectedYearId,
          termId: isAnnual ? null : selectedTermId || null,
          title: title.trim(),
          description: description.trim() || undefined,
          items,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      const data = await res.json();
      router.push(`/finance/budgets/${data.budget.id}`);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create budget.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading budget setup catalogs...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create School Budget</h1>
          <p className="text-sm text-gray-500 mt-1">
            Allocate vote head expense caps and project fee collection targets for the upcoming academic period.
          </p>
        </div>
        <Link
          href="/finance/budgets"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          Cancel
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Period & Metadata */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            1. Budget Scope &amp; Identification
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Academic Year *
              </label>
              <select
                value={selectedYearId}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {academicYears.map((yr) => (
                  <option key={yr.id} value={yr.id}>
                    {yr.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Budget Scope
              </label>
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="budgetScope"
                    checked={isAnnual}
                    onChange={() => handleAnnualToggle(true)}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  Full Academic Year
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="budgetScope"
                    checked={!isAnnual}
                    onChange={() => handleAnnualToggle(false)}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  Single Term
                </label>
              </div>
            </div>

            {!isAnnual && currentYear && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Term *
                </label>
                <select
                  value={selectedTermId}
                  onChange={(e) => {
                    setSelectedTermId(e.target.value);
                    const t = currentYear.terms.find((term) => term.id === e.target.value);
                    if (t) setTitle(`${currentYear.name} ${t.name} Operating Budget`);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {currentYear.terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Budget Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2026 Annual School Operating Budget"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Description / Notes
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Approved in Finance Board Resolution #12"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Expense Vote Heads */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                2. Expenditure Vote Heads
              </h2>
              <p className="text-xs text-gray-500">
                Set approved ceiling allocations for each expense category.
              </p>
            </div>
            <div className="text-sm font-bold text-gray-900">
              Total Expense: UGX {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Vote Head Code</th>
                  <th className="py-2.5 px-3">Category Name</th>
                  <th className="py-2.5 px-3 w-48 text-right">Allocated Amount (UGX)</th>
                  <th className="py-2.5 px-3">Notes / Budget Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {voteHeads.map((vh, idx) => (
                  <tr key={vh.categoryId} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono font-semibold text-xs text-gray-700">
                      {vh.code}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-900">{vh.name}</td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={vh.amount}
                        data-testid={`votehead-input-${vh.code}`}
                        onChange={(e) => updateVoteHeadAmount(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm text-right font-mono font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={vh.notes}
                        onChange={(e) => updateVoteHeadNotes(idx, e.target.value)}
                        placeholder="Optional allocation note"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Revenue Targets */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                3. Revenue Realization Targets
              </h2>
              <p className="text-xs text-gray-500">
                Target fee billing and collection figures across fee categories.
              </p>
            </div>
            <div className="text-sm font-bold text-emerald-700">
              Total Target Revenue: UGX {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Target Code</th>
                  <th className="py-2.5 px-3">Fee Type / Revenue Stream</th>
                  <th className="py-2.5 px-3 w-48 text-right">Target Amount (UGX)</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {revenueTargets.map((rt, idx) => (
                  <tr key={rt.feeTypeId} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono font-semibold text-xs text-gray-700">
                      {rt.code}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-900">{rt.name}</td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rt.amount}
                        data-testid={`revenue-input-${rt.code}`}
                        onChange={(e) => updateRevenueAmount(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm text-right font-mono font-semibold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={rt.notes}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRevenueTargets((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], notes: val };
                            return next;
                          });
                        }}
                        placeholder="e.g. Expected 450 enrolled students"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sticky Bottom Summary & Save Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 shadow-xl z-20">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-gray-500 block uppercase font-bold">Total Expense</span>
                <span className="text-base font-bold text-gray-900 font-mono">
                  UGX {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div>
                <span className="text-xs text-gray-500 block uppercase font-bold">Target Revenue</span>
                <span className="text-base font-bold text-emerald-700 font-mono">
                  UGX {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div>
                <span className="text-xs text-gray-500 block uppercase font-bold">Net Surplus / Deficit</span>
                <span
                  className={`text-base font-bold font-mono ${
                    netSurplus >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  UGX {netSurplus.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="save-budget-btn"
                className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? 'Saving Draft Budget...' : 'Save Draft Budget →'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
