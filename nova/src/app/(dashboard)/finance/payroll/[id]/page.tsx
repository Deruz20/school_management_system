'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  XCircle,
  Download,
  DollarSign,
  Send,
  Plus,
  Eye,
  FileCheck2,
  RefreshCw,
  CornerUpLeft,
} from 'lucide-react';
import { PayslipModal, PayslipData } from '@/components/finance/PayslipModal';
import { PayrollRunExportModal } from '@/components/finance/PayrollRunExportModal';
import { AddPayslipItemModal } from '@/components/finance/AddPayslipItemModal';

interface PayrollRunDetail {
  id: string;
  payrollNumber: string;
  title: string;
  year: number;
  month: number;
  status: string;
  totalEmployees: number;
  totalBasic: number | string;
  totalAllowances: number | string;
  totalDeductions: number | string;
  totalNet: number | string;
  totalEmployerCost: number | string;
  expense?: {
    id: string;
    voucherNumber: string;
    status: string;
  } | null;
  payslips?: PayslipData[];
}

export default function PayrollRunDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipData | null>(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [adjustingPayslip, setAdjustingPayslip] = useState<PayslipData | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    let ignore = false;
    fetch(`/api/payroll/runs/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          if (data.payrollRun) {
            setRun(data.payrollRun);
          } else {
            setError(data.error || 'Failed to fetch payroll run');
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          const message = err instanceof Error ? err.message : 'Error fetching payroll run';
          setError(message);
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [id, refreshIndex]);

  const refreshData = () => setRefreshIndex((prev) => prev + 1);

  const handleAction = async (action: 'submit' | 'approve' | 'disburse' | 'reject' | 'cancel') => {
    let reason = '';
    if (action === 'reject' || action === 'cancel') {
      const promptText = action === 'reject' ? 'Reason for returning to Draft (min 5 chars):' : 'Reason for cancellation/reversal (min 10 chars):';
      const input = prompt(promptText);
      if (!input) return;
      reason = input.trim();
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/payroll/runs/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Action ${action} failed`);
      }

      refreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      alert(`Error: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
        <p>Loading payroll run details...</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <Link href="/finance/payroll" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Back to Payroll
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
          {error || 'Payroll run not found.'}
        </div>
      </div>
    );
  }

  const filteredPayslips = (run.payslips || []).filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.employeeName.toLowerCase().includes(q) ||
      p.employeeCode.toLowerCase().includes(q) ||
      (p.departmentName && p.departmentName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Status Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/finance/payroll"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Payroll Hub
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{run.title}</h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
              {run.payrollNumber}
            </span>
          </div>
        </div>

        {/* Action Buttons depending on State */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Schedules
          </button>

          {run.status === 'DRAFT' && (
            <button
              onClick={() => handleAction('submit')}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Submit for Approval
            </button>
          )}

          {run.status === 'SUBMITTED' && (
            <>
              <button
                onClick={() => handleAction('reject')}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
                Return to Draft
              </button>
              <button
                onClick={() => handleAction('approve')}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Approve Run
              </button>
            </>
          )}

          {run.status === 'APPROVED' && (
            <>
              <button
                onClick={() => handleAction('reject')}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
                Return to Draft
              </button>
              <button
                onClick={() => handleAction('disburse')}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Disburse Net Salaries
              </button>
            </>
          )}

          {run.status === 'PAID' && (
            <button
              onClick={() => handleAction('cancel')}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900 rounded-xl transition"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reverse &amp; Void Run
            </button>
          )}
        </div>
      </div>

      {/* Financial Summary Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-[10px] uppercase font-bold text-slate-400">Status</p>
          <p className="text-sm font-bold mt-1 text-slate-900 dark:text-slate-100">{run.status}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-[10px] uppercase font-bold text-slate-400">Total Basic Salary</p>
          <p className="text-sm font-bold font-mono mt-1 text-slate-900 dark:text-slate-100">{Number(run.totalBasic).toLocaleString()} UGX</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-[10px] uppercase font-bold text-slate-400">Allowances</p>
          <p className="text-sm font-bold font-mono mt-1 text-emerald-600 dark:text-emerald-400">+{Number(run.totalAllowances).toLocaleString()} UGX</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-[10px] uppercase font-bold text-slate-400">Deductions (NSSF+PAYE)</p>
          <p className="text-sm font-bold font-mono mt-1 text-rose-600 dark:text-rose-400">-{Number(run.totalDeductions).toLocaleString()} UGX</p>
        </div>
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Total Net Remuneration</p>
          <p className="text-base font-black font-mono mt-1 text-emerald-800 dark:text-emerald-200">{Number(run.totalNet).toLocaleString()} UGX</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-[10px] uppercase font-bold text-slate-400">Total Employer Cost</p>
          <p className="text-sm font-bold font-mono mt-1 text-blue-600 dark:text-blue-400">{Number(run.totalEmployerCost).toLocaleString()} UGX</p>
        </div>
      </div>

      {/* Linked Expense Outflow Banner if Paid */}
      {run.expense && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="font-bold">Operational Cash Outflow Journal Created</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Linked Expense Voucher: <span className="font-mono font-bold">{run.expense.voucherNumber}</span> ({run.expense.status}) for UGX {Number(run.totalNet).toLocaleString()}
              </p>
            </div>
          </div>
          <Link
            href="/finance/expenses"
            className="px-3 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-500 transition shadow-sm"
          >
            View Expense Journal
          </Link>
        </div>
      )}

      {/* Payslips Register Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Employee Payslip Register</h3>
            <p className="text-xs text-slate-500 mt-0.5">{run.payslips?.length || 0} staff included in this calculation</p>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search staff name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 border-b border-slate-100 dark:border-slate-800 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-5">Staff</th>
                <th className="py-3 px-5">Department</th>
                <th className="py-3 px-5">Channel</th>
                <th className="py-3 px-5 text-right">Basic Pay</th>
                <th className="py-3 px-5 text-right">Allowances</th>
                <th className="py-3 px-5 text-right">Gross Pay</th>
                <th className="py-3 px-5 text-right">Deductions</th>
                <th className="py-3 px-5 text-right">Take-Home Net</th>
                <th className="py-3 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredPayslips.map((ps) => (
                <tr key={ps.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                  <td className="py-3 px-5">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{ps.employeeName}</div>
                    <div className="font-mono text-[11px] text-slate-400">{ps.employeeCode} • {ps.payslipNumber}</div>
                  </td>
                  <td className="py-3 px-5 text-slate-500 font-medium">
                    {ps.departmentName || 'General'}
                  </td>
                  <td className="py-3 px-5">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{ps.paymentMethod}</span>
                    {ps.bankName && <div className="text-[10px] text-slate-400">{ps.bankName}</div>}
                    {ps.mobileMoneyNumber && <div className="text-[10px] text-slate-400">{ps.mobileMoneyNumber}</div>}
                  </td>
                  <td className="py-3 px-5 text-right font-mono font-medium">
                    {Number(ps.baseSalary).toLocaleString()} UGX
                  </td>
                  <td className="py-3 px-5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                    +{Number((ps.items || []).filter((i) => i.type === 'ALLOWANCE').reduce((sum, it) => sum + Number(it.amount), 0)).toLocaleString()} UGX
                  </td>
                  <td className="py-3 px-5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {Number(ps.grossSalary).toLocaleString()} UGX
                  </td>
                  <td className="py-3 px-5 text-right font-mono text-rose-600 dark:text-rose-400">
                    -{Number(ps.totalDeductions).toLocaleString()} UGX
                  </td>
                  <td className="py-3 px-5 text-right font-mono font-black text-emerald-700 dark:text-emerald-300">
                    {Number(ps.netSalary).toLocaleString()} UGX
                  </td>
                  <td className="py-3 px-5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedPayslip(ps);
                          setIsPayslipModalOpen(true);
                        }}
                        className="p-1 text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        title="View Official Payslip"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {run.status === 'DRAFT' && (
                        <button
                          onClick={() => {
                            setAdjustingPayslip(ps);
                            setIsAdjustModalOpen(true);
                          }}
                          className="p-1 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                          title="Add Ad-hoc Item"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PayslipModal
        isOpen={isPayslipModalOpen}
        onClose={() => setIsPayslipModalOpen(false)}
        payslip={selectedPayslip}
      />

      <PayrollRunExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        payrollRunId={run.id}
        payrollNumber={run.payrollNumber}
        runTitle={run.title}
      />

      <AddPayslipItemModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        payslip={adjustingPayslip}
        onItemAdded={refreshData}
      />
    </div>
  );
}
