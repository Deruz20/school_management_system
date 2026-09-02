'use client';

import React from 'react';
import { X, Download, Building, Smartphone, FileSpreadsheet, ShieldAlert } from 'lucide-react';

interface PayrollRunExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollRunId: string;
  payrollNumber: string;
  runTitle: string;
}

export const PayrollRunExportModal: React.FC<PayrollRunExportModalProps> = ({
  isOpen,
  onClose,
  payrollRunId,
  payrollNumber,
  runTitle,
}) => {
  if (!isOpen) return null;

  const handleDownload = (type: 'bank' | 'momo' | 'nssf' | 'paye') => {
    window.open(`/api/payroll/runs/${payrollRunId}/export/${type}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Export Schedules & Returns</h3>
            <p className="text-xs text-slate-500 mt-0.5">{runTitle} ({payrollNumber})</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {/* Bank Transfer Schedule */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Bank Payment Schedule</h4>
                <p className="text-xs text-slate-500">Stanbic, Centenary, ABSA formatted CSV</p>
              </div>
            </div>
            <button
              onClick={() => handleDownload('bank')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
          </div>

          {/* Mobile Money Payout Schedule */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-lg">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Mobile Money Payout Schedule</h4>
                <p className="text-xs text-slate-500">MTN MoMo & Airtel Money batch format</p>
              </div>
            </div>
            <button
              onClick={() => handleDownload('momo')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
          </div>

          {/* NSSF Form C Monthly Returns */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">NSSF Form C Monthly Return</h4>
                <p className="text-xs text-slate-500">5% employee + 10% employer NSSF schedule</p>
              </div>
            </div>
            <button
              onClick={() => handleDownload('nssf')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
          </div>

          {/* URA Monthly PAYE Returns */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-lg">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">URA PAYE Monthly Tax Return</h4>
                <p className="text-xs text-slate-500">e-tax compliant monthly withholding schedule</p>
              </div>
            </div>
            <button
              onClick={() => handleDownload('paye')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
