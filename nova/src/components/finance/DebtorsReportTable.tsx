'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Download, AlertTriangle, ArrowRight, User } from 'lucide-react';
import Link from 'next/link';

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

interface ClassOption {
  id: string;
  name: string;
}

interface DebtorsReportTableProps {
  initialDebtors: DebtorItem[];
  totalDebtors: number;
  totalDebtAmount: string | number;
  classes: ClassOption[];
}

export default function DebtorsReportTable({
  initialDebtors,
  totalDebtors,
  totalDebtAmount,
  classes
}: DebtorsReportTableProps) {
  const [debtors, setDebtors] = useState<DebtorItem[]>(initialDebtors);
  const [totalCount, setTotalCount] = useState(totalDebtors);
  const [totalSum, setTotalSum] = useState(totalDebtAmount);

  const [selectedClass, setSelectedClass] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchDebtors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClass) params.set('classId', selectedClass);
      if (minBalance) params.set('minBalance', minBalance);
      if (search) params.set('search', search);

      const res = await fetch(`/api/finance-reports/debtors?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDebtors(data.debtors);
        setTotalCount(data.summary.totalDebtors);
        setTotalSum(data.summary.totalDebtAmount);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDebtors();
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedClass) params.set('classId', selectedClass);
      if (minBalance) params.set('minBalance', minBalance);
      if (search) params.set('search', search);

      window.open(`/api/finance-reports/debtors/export?${params.toString()}`, '_blank');
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      maximumFractionDigits: 0
    }).format(num || 0);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle size={18} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Top Outstanding Balances & Defaulters</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative AR subledger debtors with positive balance due ({totalCount} students, {formatCurrency(totalSum)} total)
          </p>
        </div>

        <Button
          onClick={handleExportCsv}
          disabled={exporting}
          variant="outline"
          className="font-bold gap-2 text-xs border-slate-200 h-9"
        >
          <Download size={14} /> {exporting ? 'Exporting...' : 'Export Defaulters (CSV)'}
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="px-6">
        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or admission no..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
            />
          </div>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-medium text-slate-700"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={minBalance}
            onChange={(e) => setMinBalance(e.target.value)}
            placeholder="Min Debt (UGX)"
            className="w-32 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
          />

          <Button type="submit" variant="secondary" disabled={loading} className="font-bold text-xs h-8">
            {loading ? 'Filtering...' : 'Filter'}
          </Button>
        </form>
      </div>

      {/* Debtors Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-6">Student</th>
              <th className="py-3 px-4">Admission No</th>
              <th className="py-3 px-4">Class / Stream</th>
              <th className="py-3 px-4 text-right">Total Billed</th>
              <th className="py-3 px-4 text-right">Total Paid</th>
              <th className="py-3 px-6 text-right">Outstanding Debt</th>
              <th className="py-3 px-4 text-center">Last Payment</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm font-medium">
            {debtors.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  No outstanding student balances found. 🎉
                </td>
              </tr>
            ) : (
              debtors.map((d) => (
                <tr key={d.studentId} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-6 font-bold text-slate-900 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs">
                      <User size={13} />
                    </div>
                    {d.fullName}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{d.admissionNo}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {d.className} {d.streamName ? `(${d.streamName})` : ''}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-600">{formatCurrency(d.totalDebits)}</td>
                  <td className="py-3.5 px-4 text-right text-emerald-600 font-semibold">{formatCurrency(d.totalCredits)}</td>
                  <td className="py-3.5 px-6 text-right font-extrabold text-rose-600 text-sm">
                    {formatCurrency(d.balance)}
                  </td>
                  <td className="py-3.5 px-4 text-center text-xs text-slate-500">
                    {d.lastPaymentDate ? new Date(d.lastPaymentDate).toLocaleDateString('en-GB') : 'Never'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link href={`/finance/ledger?studentId=${d.studentId}`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-semibold gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                        Ledger <ArrowRight size={12} />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
