'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  Users,
  Calendar,
  Plus,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import { GeneratePayrollRunModal } from '@/components/finance/GeneratePayrollRunModal';

interface PayrollRunListItem {
  id: string;
  payrollNumber: string;
  title: string;
  year: number;
  month: number;
  status: string;
  totalEmployees: number;
  totalGross: number | string;
  totalDeductions: number | string;
  totalNet: number | string;
  totalEmployerCost: number | string;
}

export default function PayrollDashboardPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<PayrollRunListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/payroll/runs?year=${selectedYear}`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setRuns(data.runs || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load payroll runs:', err);
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [selectedYear, refreshIndex]);

  const refreshData = () => setRefreshIndex((prev) => prev + 1);

  // Metric cards calculations
  const totalPaidYTD = runs
    .filter((r) => r.status === 'PAID')
    .reduce((sum, r) => sum + Number(r.totalNet || 0), 0);

  const totalEmployerCostYTD = runs
    .filter((r) => r.status === 'PAID')
    .reduce((sum, r) => sum + Number(r.totalEmployerCost || 0), 0);

  const latestRun = runs[0];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" /> Draft
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Clock className="w-3 h-3" /> Submitted for Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <ShieldCheck className="w-3 h-3" /> Approved (Ready for Payout)
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Disbursed &amp; Posted
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3" /> Cancelled / Reversed
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Staff Payroll &amp; Compensation
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Phase 3.1F
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monthly salary runs, Uganda NSSF &amp; PAYE statutory compliance, banking schedules, and automated expense integration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/finance/payroll/compensation"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
          >
            <Sliders className="w-4 h-4 text-slate-500" />
            Compensation Profiles
          </Link>

          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Generate Monthly Payroll
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>DISBURSED YTD ({selectedYear})</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
            {totalPaidYTD.toLocaleString()} <span className="text-xs font-bold text-slate-400">UGX</span>
          </p>
          <p className="text-[11px] text-slate-500">Total net remuneration paid to staff</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>TOTAL WAGE BILL YTD</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
            {totalEmployerCostYTD.toLocaleString()} <span className="text-xs font-bold text-slate-400">UGX</span>
          </p>
          <p className="text-[11px] text-slate-500">Gross remuneration + Employer NSSF (10%)</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>LATEST RUN STATUS</span>
            <Calendar className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">
            {latestRun ? latestRun.title : 'No runs generated'}
          </p>
          <div>{latestRun ? getStatusBadge(latestRun.status) : <span className="text-xs text-slate-400">N/A</span>}</div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>STAFF REMUNERATED</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
            {latestRun ? latestRun.totalEmployees : 0} <span className="text-xs font-bold text-slate-400">staff</span>
          </p>
          <p className="text-[11px] text-slate-500">In latest payroll period</p>
        </div>
      </div>

      {/* Payroll Runs Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Payroll Periods &amp; Runs</h3>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-500 font-medium">Filter Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-semibold text-slate-800 dark:text-slate-200"
            >
              {[2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 border-b border-slate-100 dark:border-slate-800 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Payroll Number</th>
                <th className="py-3.5 px-6">Period / Title</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Staff Count</th>
                <th className="py-3.5 px-6 text-right">Gross Pay</th>
                <th className="py-3.5 px-6 text-right">Deductions</th>
                <th className="py-3.5 px-6 text-right">Net Remuneration</th>
                <th className="py-3.5 px-6 text-right">Employer Cost</th>
                <th className="py-3.5 px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading payroll runs...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No payroll runs recorded for {selectedYear}. Click &quot;Generate Monthly Payroll&quot; to create one.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {run.payrollNumber}
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-900 dark:text-slate-100">
                      {run.title}
                    </td>
                    <td className="py-4 px-6">{getStatusBadge(run.status)}</td>
                    <td className="py-4 px-6 text-right font-mono font-semibold">
                      {run.totalEmployees}
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {Number(run.totalGross).toLocaleString()} UGX
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-rose-600 dark:text-rose-400 font-semibold">
                      -{Number(run.totalDeductions).toLocaleString()} UGX
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {Number(run.totalNet).toLocaleString()} UGX
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-slate-500 font-medium">
                      {Number(run.totalEmployerCost).toLocaleString()} UGX
                    </td>
                    <td className="py-4 px-6 text-center">
                      <Link
                        href={`/finance/payroll/${run.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition"
                      >
                        View Details
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <GeneratePayrollRunModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onGenerated={(runId) => {
          refreshData();
          router.push(`/finance/payroll/${runId}`);
        }}
      />
    </div>
  );
}
