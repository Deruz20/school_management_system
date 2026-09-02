'use client';

import React from 'react';
import { Printer, X, Building2, User, CreditCard, ShieldCheck } from 'lucide-react';

export interface PayslipItemData {
  id?: string;
  name: string;
  code: string;
  type: string;
  amount: number | string;
  isTaxable?: boolean;
  notes?: string;
}

export interface PayslipData {
  id: string;
  payslipNumber: string;
  employeeName: string;
  employeeCode: string;
  departmentName?: string | null;
  employeeTypeName?: string | null;
  paymentMethod: string;
  bankName?: string | null;
  accountNumber?: string | null;
  mobileMoneyNumber?: string | null;
  tinNumber?: string | null;
  nssfNumber?: string | null;
  baseSalary: number | string;
  grossSalary: number | string;
  totalDeductions: number | string;
  netSalary: number | string;
  employerContribution: number | string;
  status: string;
  paymentDate?: string | Date | null;
  updatedAt?: string | Date;
  payrollRun?: {
    title: string;
  };
  items?: PayslipItemData[];
}

interface PayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  payslip: PayslipData | null;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({ isOpen, onClose, payslip }) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !payslip) return null;

  const handlePrint = () => {
    window.print();
  };

  const allowances = (payslip.items || []).filter((i) => i.type === 'ALLOWANCE');
  const deductions = (payslip.items || []).filter((i) => i.type === 'DEDUCTION');
  const employerContribs = (payslip.items || []).filter((i) => i.type === 'EMPLOYER_CONTRIBUTION');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden print:border-none print:shadow-none print:max-w-full">
        {/* Header Actions (hidden in print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {payslip.payslipNumber}
            </span>
            <span className="text-sm text-slate-500 font-medium">Official Remuneration Advice</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Payslip
            </button>
            <button
              onClick={onClose}
              aria-label="Close Payslip"
              data-testid="close-payslip-modal"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 space-y-6 print:p-4">
          {/* Institutional Header */}
          <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-xl tracking-tight">
                <Building2 className="w-6 h-6" />
                <span>NOVA ACADEMY</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Excellence in Holistic Education & Leadership</p>
              <p className="text-xs text-slate-500">Kampala, Uganda | Tax TIN: 1000289190</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold uppercase tracking-wider rounded-md border border-slate-200 dark:border-slate-700">
                PAYSLIP
              </span>
              <p className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 mt-1.5">{payslip.payslipNumber}</p>
              <p className="text-xs text-slate-500">Period: {payslip.payrollRun?.title || 'Monthly Payroll'}</p>
              {payslip.status === 'PAID' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  <ShieldCheck className="w-3 h-3" /> PAID ON {new Date(payslip.paymentDate || payslip.updatedAt || '2026-01-01').toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Employee & Bank Summary Grid */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100 text-sm">
                <User className="w-4 h-4 text-slate-400" />
                {payslip.employeeName}
              </div>
              <p className="text-slate-500">Employee Code: <span className="font-semibold text-slate-700 dark:text-slate-300">{payslip.employeeCode}</span></p>
              <p className="text-slate-500">Department: <span className="font-semibold text-slate-700 dark:text-slate-300">{payslip.departmentName || 'General'}</span></p>
              <p className="text-slate-500">Designation: <span className="font-semibold text-slate-700 dark:text-slate-300">{payslip.employeeTypeName || 'Staff'}</span></p>
            </div>
            <div className="space-y-1.5 border-l border-slate-200 dark:border-slate-700 pl-4">
              <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <CreditCard className="w-4 h-4 text-slate-400" />
                {payslip.paymentMethod}
              </div>
              {payslip.bankName && <p className="text-slate-500">Bank: <span className="font-semibold text-slate-700 dark:text-slate-300">{payslip.bankName} ({payslip.accountNumber})</span></p>}
              {payslip.mobileMoneyNumber && <p className="text-slate-500">Mobile Money: <span className="font-semibold text-slate-700 dark:text-slate-300">{payslip.mobileMoneyNumber}</span></p>}
              <p className="text-slate-500">NSSF No: <span className="font-mono text-slate-700 dark:text-slate-300">{payslip.nssfNumber || 'N/A'}</span></p>
              <p className="text-slate-500">URA TIN: <span className="font-mono text-slate-700 dark:text-slate-300">{payslip.tinNumber || 'N/A'}</span></p>
            </div>
          </div>

          {/* Earnings & Deductions Tables (Two Columns) */}
          <div className="grid grid-cols-2 gap-6">
            {/* Earnings Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 border-b border-emerald-100 dark:border-emerald-900/50">
                <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">Earnings & Allowances</h4>
              </div>
              <div className="p-3 space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800">
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Basic Contract Salary</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{Number(payslip.baseSalary).toLocaleString()} UGX</span>
                </div>
                {allowances.map((it, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-400">{it.name}</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{Number(it.amount).toLocaleString()} UGX</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-bold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700">
                  <span>Total Gross Earnings</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{Number(payslip.grossSalary).toLocaleString()} UGX</span>
                </div>
              </div>
            </div>

            {/* Deductions Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2 border-b border-rose-100 dark:border-rose-900/50">
                <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider">Deductions & Taxes</h4>
              </div>
              <div className="p-3 space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800">
                {deductions.map((it, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-400">{it.name}</span>
                    <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">-{Number(it.amount).toLocaleString()} UGX</span>
                  </div>
                ))}
                {deductions.length === 0 && (
                  <div className="text-slate-400 italic py-2 text-center">No deductions</div>
                )}
                <div className="flex justify-between pt-2 font-bold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700">
                  <span>Total Deductions</span>
                  <span className="font-mono text-rose-600 dark:text-rose-400">-{Number(payslip.totalDeductions).toLocaleString()} UGX</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Pay Callout Banner */}
          <div className="flex items-center justify-between p-4 bg-emerald-600 text-white rounded-xl shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">Take-Home Net Salary</p>
              <p className="text-xs text-emerald-100/80 mt-0.5">Disbursed via {payslip.paymentMethod}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black font-mono tracking-tight">{Number(payslip.netSalary).toLocaleString()} <span className="text-sm font-semibold">UGX</span></p>
            </div>
          </div>

          {/* Statutory Employer Contributions (Informational) */}
          {employerContribs.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-500 font-semibold uppercase text-[10px]">Employer Institutional Remittance (Not deducted from pay):</span>
              <div className="flex justify-between mt-1 text-slate-600 dark:text-slate-400">
                <span>NSSF Employer Contribution (10%)</span>
                <span className="font-mono font-semibold">{Number(payslip.employerContribution).toLocaleString()} UGX</span>
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 text-center">
            <div>
              <div className="border-b border-slate-300 dark:border-slate-700 mb-2 h-10"></div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Prepared By (Bursar)</p>
            </div>
            <div>
              <div className="border-b border-slate-300 dark:border-slate-700 mb-2 h-10"></div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Approved By (Headteacher)</p>
            </div>
            <div>
              <div className="border-b border-slate-300 dark:border-slate-700 mb-2 h-10"></div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Employee Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
