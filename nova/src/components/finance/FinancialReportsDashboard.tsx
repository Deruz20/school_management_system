'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  AlertTriangle,
  Receipt,
  Percent,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import CashFlowChart from './CashFlowChart';
import DebtorsReportTable from './DebtorsReportTable';

interface AcademicYearOption {
  id: string;
  name: string;
}

interface TermOption {
  id: string;
  name: string;
  academicYearId: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface ExecutiveSummary {
  accrual: {
    invoiceCount: number;
    grossBilled: string | number;
    discountAmount: string | number;
    netBilled: string | number;
    termCollected: string | number;
    outstanding: string | number;
    collectionRate: number;
  };
  cashFlow: {
    feePaymentCount: number;
    totalFeeInflows: string | number;
    expenseCount: number;
    totalOperationalExpenses: string | number;
    netOperatingCashFlow: string | number;
  };
}

interface ClassCollectionItem {
  classId: string;
  className: string;
  studentCount: number;
  invoiceCount: number;
  grossBilled: string | number;
  discountAmount: string | number;
  netBilled: string | number;
  collected: string | number;
  outstanding: string | number;
  collectionRate: number;
}

interface TermCollectionItem {
  termId: string;
  termName: string;
  studentCount: number;
  invoiceCount: number;
  grossBilled: string | number;
  discountAmount: string | number;
  netBilled: string | number;
  collected: string | number;
  outstanding: string | number;
  collectionRate: number;
}

interface MonthCashFlow {
  key: string;
  label: string;
  shortMonth: string;
  year: number;
  feesIn: string | number;
  expensesOut: string | number;
  netCashFlow: string | number;
}

interface ChannelItem {
  method: string;
  count: number;
  totalAmount: string | number;
  percentage: number;
}

interface DebtorItem {
  studentId: string;
  admissionNo: string;
  fullName: string;
  className: string;
  streamName: string | null;
  balance: string | number;
  totalDebits: string | number;
  totalCredits: string | number;
  lastPaymentDate: string | null;
}

interface FinancialReportsDashboardProps {
  initialSummary: ExecutiveSummary;
  initialClassCollection: ClassCollectionItem[];
  initialTermCollection: TermCollectionItem[];
  initialCashFlow: MonthCashFlow[];
  initialPaymentChannels: {
    totalTransactions: number;
    totalVolume: string | number;
    channels: ChannelItem[];
  };
  initialDebtors: DebtorItem[];
  totalDebtors: number;
  totalDebtAmount: string | number;
  academicYears: AcademicYearOption[];
  terms: TermOption[];
  classes: ClassOption[];
  currentYearId?: string;
  currentTermId?: string;
}

export default function FinancialReportsDashboard({
  initialSummary,
  initialClassCollection,
  initialTermCollection,
  initialCashFlow,
  initialPaymentChannels,
  initialDebtors,
  totalDebtors,
  totalDebtAmount,
  academicYears,
  terms,
  classes,
  currentYearId,
  currentTermId
}: FinancialReportsDashboardProps) {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState(currentYearId || academicYears[0]?.id || '');
  const [selectedTerm, setSelectedTerm] = useState(currentTermId || '');

  const filteredTerms = terms.filter((t) => !selectedYear || t.academicYearId === selectedYear);

  const handleYearChange = (yearId: string) => {
    setSelectedYear(yearId);
    setSelectedTerm('');
    router.push(`/finance/reports?academicYearId=${yearId}`);
  };

  const handleTermChange = (termId: string) => {
    setSelectedTerm(termId);
    const url = termId
      ? `/finance/reports?academicYearId=${selectedYear}&termId=${termId}`
      : `/finance/reports?academicYearId=${selectedYear}`;
    router.push(url);
  };

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      maximumFractionDigits: 0
    }).format(num || 0);
  };

  const netCashFlowNum = typeof initialSummary.cashFlow.netOperatingCashFlow === 'string'
    ? parseFloat(initialSummary.cashFlow.netOperatingCashFlow)
    : initialSummary.cashFlow.netOperatingCashFlow;

  return (
    <div className="space-y-8">
      {/* Year & Term Context Filter Ribbon */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <Calendar size={18} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Accounting Context
            </span>
            <span className="text-sm font-bold text-slate-900">
              {academicYears.find((y) => y.id === selectedYear)?.name || 'All Years'}
              {selectedTerm && ` • ${terms.find((t) => t.id === selectedTerm)?.name}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedTerm}
              onChange={(e) => handleTermChange(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">All Terms (Full Year)</option>
              {filteredTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Billed */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Net Billed</span>
            <Receipt size={14} className="text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {formatCurrency(initialSummary.accrual.netBilled)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Gross: {formatCurrency(initialSummary.accrual.grossBilled)} (Less {formatCurrency(initialSummary.accrual.discountAmount)} Bursary)
          </p>
        </div>

        {/* Collected */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Collected</span>
            <TrendingUp size={14} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600">
            {formatCurrency(initialSummary.accrual.termCollected)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Active allocations to term invoices
          </p>
        </div>

        {/* Outstanding */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Outstanding AR</span>
            <AlertTriangle size={14} className="text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600">
            {formatCurrency(initialSummary.accrual.outstanding)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Net receivables uncollected
          </p>
        </div>

        {/* Collection Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Collection Rate</span>
            <Percent size={14} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {initialSummary.accrual.collectionRate}%
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
            <div
              style={{ width: `${Math.min(100, Math.max(0, initialSummary.accrual.collectionRate))}%` }}
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            />
          </div>
        </div>
      </div>

      {/* Secondary KPI Ribbon: Inflow, Outflow, Net Cash */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Fee Cash Inflows</span>
            <span className="text-xl font-bold text-emerald-600">{formatCurrency(initialSummary.cashFlow.totalFeeInflows)}</span>
          </div>
          <div className="p-2 bg-emerald-100/60 text-emerald-700 rounded-xl">
            <ArrowUpRight size={20} />
          </div>
        </div>

        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Operational Outflows</span>
            <span className="text-xl font-bold text-rose-600">{formatCurrency(initialSummary.cashFlow.totalOperationalExpenses)}</span>
          </div>
          <div className="p-2 bg-rose-100/60 text-rose-700 rounded-xl">
            <ArrowDownRight size={20} />
          </div>
        </div>

        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Net Operating Cash Flow</span>
            <span className={`text-xl font-extrabold ${netCashFlowNum >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {formatCurrency(initialSummary.cashFlow.netOperatingCashFlow)}
            </span>
          </div>
          <div className="p-2 bg-slate-200/70 text-slate-800 rounded-xl font-bold text-xs">
            {netCashFlowNum >= 0 ? 'Surplus' : 'Deficit'}
          </div>
        </div>
      </div>

      {/* 2-Column Layout: Collection by Class + Collection by Term */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection by Class */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Collection by Class</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">{initialClassCollection.length} classes</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase">
                  <th className="py-2.5 px-4">Class</th>
                  <th className="py-2.5 px-3 text-center">Students</th>
                  <th className="py-2.5 px-3 text-right">Net Billed</th>
                  <th className="py-2.5 px-3 text-right">Collected</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {initialClassCollection.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No billed classes in this context.
                    </td>
                  </tr>
                ) : (
                  initialClassCollection.map((c) => (
                    <tr key={c.classId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.className}</td>
                      <td className="py-3 px-3 text-center text-slate-600">{c.studentCount}</td>
                      <td className="py-3 px-3 text-right text-slate-700">{formatCurrency(c.netBilled)}</td>
                      <td className="py-3 px-3 text-right text-emerald-600 font-semibold">{formatCurrency(c.collected)}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold text-slate-900">{c.collectionRate}%</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Collection by Term & Payment Channels */}
        <div className="space-y-6">
          {/* Collection by Term */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900">Collection by Term</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase">
                    <th className="py-2.5 px-4">Term</th>
                    <th className="py-2.5 px-3 text-right">Net Billed</th>
                    <th className="py-2.5 px-3 text-right">Collected</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {initialTermCollection.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No term billing records.
                      </td>
                    </tr>
                  ) : (
                    initialTermCollection.map((t) => (
                      <tr key={t.termId} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-bold text-slate-900">{t.termName}</td>
                        <td className="py-3 px-3 text-right text-slate-700">{formatCurrency(t.netBilled)}</td>
                        <td className="py-3 px-3 text-right text-emerald-600 font-semibold">{formatCurrency(t.collected)}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">{t.collectionRate}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Channels Breakdown */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900">Payment Channel Distribution</h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {initialPaymentChannels.totalTransactions} transactions
              </span>
            </div>

            <div className="space-y-3">
              {initialPaymentChannels.channels.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No completed payment transactions yet.</p>
              ) : (
                initialPaymentChannels.channels.map((c) => (
                  <div key={c.method} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">{c.method.replace(/_/g, ' ')} ({c.count})</span>
                      <span className="text-slate-900 font-bold">
                        {formatCurrency(c.totalAmount)} ({c.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${c.percentage}%` }}
                        className="bg-emerald-500 h-full rounded-full"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 12-Month Rolling Cash Flow Chart */}
      <CashFlowChart data={initialCashFlow} />

      {/* Top Debtors & Defaulters Table */}
      <DebtorsReportTable
        initialDebtors={initialDebtors}
        totalDebtors={totalDebtors}
        totalDebtAmount={totalDebtAmount}
        classes={classes}
      />
    </div>
  );
}
