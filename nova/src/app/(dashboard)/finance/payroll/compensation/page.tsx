'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sliders,
  Edit2,
  Save,
  X,
  Loader2,
} from 'lucide-react';

interface EmployeeItem {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  department?: {
    name: string;
  } | null;
  employeeType?: {
    name: string;
  } | null;
}

interface CompensationItem {
  id: string;
  employeeId: string;
  baseSalary: number | string;
  paymentMethod: string;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  mobileMoneyNumber?: string | null;
  tinNumber?: string | null;
  nssfNumber?: string | null;
  isActive: boolean;
  employee?: EmployeeItem | null;
}

interface SalaryComponentItem {
  id: string;
  name: string;
  code: string;
  type: string;
  calculationType: string;
  percentageRate?: number | string | null;
  defaultAmount?: number | string | null;
  isStatutory: boolean;
  isTaxable: boolean;
  description?: string | null;
}

export default function CompensationProfilesPage() {
  const [activeTab, setActiveTab] = useState<'profiles' | 'components'>('profiles');
  const [compensations, setCompensations] = useState<CompensationItem[]>([]);
  const [components, setComponents] = useState<SalaryComponentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Edit Modal State
  const [editingComp, setEditingComp] = useState<CompensationItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editBaseSalary, setEditBaseSalary] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('BANK_TRANSFER');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountNo, setEditAccountNo] = useState('');
  const [editAccountName, setEditAccountName] = useState('');
  const [editMobileMoney, setEditMobileMoney] = useState('');
  const [editTin, setEditTin] = useState('');
  const [editNssf, setEditNssf] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      fetch('/api/payroll/compensation'),
      fetch('/api/payroll/components'),
    ])
      .then(async ([compRes, compoRes]) => {
        const compData = await compRes.json();
        const compoData = await compoRes.json();
        if (!ignore) {
          if (compRes.ok) setCompensations(compData.compensations || []);
          if (compoRes.ok) setComponents(compoData.components || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
      });

    return () => {
      ignore = true;
    };
  }, [refreshIndex]);

  const refreshData = () => setRefreshIndex((prev) => prev + 1);

  const openEditModal = (comp: CompensationItem) => {
    setEditingComp(comp);
    setEditBaseSalary(comp.baseSalary?.toString() || '');
    setEditPaymentMethod(comp.paymentMethod || 'BANK_TRANSFER');
    setEditBankName(comp.bankName || '');
    setEditAccountNo(comp.accountNumber || '');
    setEditAccountName(comp.accountName || '');
    setEditMobileMoney(comp.mobileMoneyNumber || '');
    setEditTin(comp.tinNumber || '');
    setEditNssf(comp.nssfNumber || '');
    setIsEditModalOpen(true);
  };

  const handleSaveCompensation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComp) return;
    setIsSaving(true);

    try {
      const res = await fetch('/api/payroll/compensation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: editingComp.employeeId,
          baseSalary: parseFloat(editBaseSalary),
          paymentMethod: editPaymentMethod,
          bankName: editBankName,
          accountNumber: editAccountNo,
          accountName: editAccountName,
          mobileMoneyNumber: editMobileMoney,
          tinNumber: editTin,
          nssfNumber: editNssf,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setIsEditModalOpen(false);
      refreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      alert(`Error: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCompensations = compensations.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      (c.employee?.firstName && c.employee.firstName.toLowerCase().includes(q)) ||
      (c.employee?.lastName && c.employee.lastName.toLowerCase().includes(q)) ||
      (c.employee?.employeeCode && c.employee.employeeCode.toLowerCase().includes(q)) ||
      (c.employee?.department?.name && c.employee.department.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/finance/payroll"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Payroll Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Sliders className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Staff Compensation Profiles &amp; Salary Rules
            </h1>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'profiles'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Employee Salaries ({compensations.length})
          </button>
          <button
            onClick={() => setActiveTab('components')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'components'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Salary Components Catalog ({components.length})
          </button>
        </div>
      </div>

      {activeTab === 'profiles' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 gap-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Staff Compensation Profiles</h3>
            <div className="w-72">
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
                  <th className="py-3 px-5">Staff Member</th>
                  <th className="py-3 px-5">Department / Role</th>
                  <th className="py-3 px-5 text-right">Base Salary (UGX)</th>
                  <th className="py-3 px-5">Disbursement Channel</th>
                  <th className="py-3 px-5">Statutory IDs (NSSF / TIN)</th>
                  <th className="py-3 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredCompensations.map((comp) => (
                  <tr key={comp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {comp.employee?.firstName} {comp.employee?.lastName}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">{comp.employee?.employeeCode}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{comp.employee?.department?.name || 'General'}</span>
                      <div className="text-[11px] text-slate-400">{comp.employee?.employeeType?.name || 'Staff'}</div>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                      {Number(comp.baseSalary).toLocaleString()} UGX
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{comp.paymentMethod}</span>
                      {comp.bankName && <div className="text-[10px] text-slate-400">{comp.bankName} ({comp.accountNumber})</div>}
                      {comp.mobileMoneyNumber && <div className="text-[10px] text-slate-400">{comp.mobileMoneyNumber}</div>}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-500">
                      <div>NSSF: {comp.nssfNumber || '—'}</div>
                      <div>TIN: {comp.tinNumber || '—'}</div>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <button
                        onClick={() => openEditModal(comp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Salary Components Catalog */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Standard Salary Components &amp; Statutory Deductions</h3>
            <p className="text-xs text-slate-500 mt-0.5">Calculated components automatically applied during payroll runs</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 border-b border-slate-100 dark:border-slate-800 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-5">Component Name</th>
                  <th className="py-3 px-5">Code</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Calculation Logic</th>
                  <th className="py-3 px-5 text-right">Default Value / Rate</th>
                  <th className="py-3 px-5 text-center">Statutory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {components.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-slate-100">{c.name}</td>
                    <td className="py-3.5 px-5 font-mono text-slate-500">{c.code}</td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.type === 'ALLOWANCE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                        c.type === 'DEDUCTION' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                        'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      }`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-medium">{c.calculationType}</td>
                    <td className="py-3.5 px-5 text-right font-mono font-semibold">
                      {c.percentageRate ? `${c.percentageRate}%` : c.defaultAmount ? `${Number(c.defaultAmount).toLocaleString()} UGX` : 'Progressive / Dynamic'}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      {c.isStatutory ? (
                        <span className="text-emerald-600 font-bold">Yes (Uganda)</span>
                      ) : (
                        <span className="text-slate-400">Custom</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && editingComp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Edit Staff Compensation</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingComp.employee?.firstName} {editingComp.employee?.lastName} ({editingComp.employee?.employeeCode})</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompensation} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Base Monthly Salary (UGX)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={editBaseSalary}
                  onChange={(e) => setEditBaseSalary(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="MOBILE_MONEY">Mobile Money (MTN / Airtel)</option>
                  <option value="CASH">Cash Remuneration</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              {editPaymentMethod === 'BANK_TRANSFER' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Stanbic Bank"
                      value={editBankName}
                      onChange={(e) => setEditBankName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 9030012345678"
                      value={editAccountNo}
                      onChange={(e) => setEditAccountNo(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}

              {editPaymentMethod === 'MOBILE_MONEY' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile Money Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 256770000000"
                    value={editMobileMoney}
                    onChange={(e) => setEditMobileMoney(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">NSSF Number</label>
                  <input
                    type="text"
                    placeholder="13-digit NSSF No"
                    value={editNssf}
                    onChange={(e) => setEditNssf(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">URA TIN</label>
                  <input
                    type="text"
                    placeholder="10-digit TIN"
                    value={editTin}
                    onChange={(e) => setEditTin(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
