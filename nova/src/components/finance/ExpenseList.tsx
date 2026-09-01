'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Search,
  Filter,
  Ban,
  Calendar,
  DollarSign,
  TrendingDown,
  Building,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import ExpenseModal from './ExpenseModal';
import { PaymentMethod, ExpenseStatus } from '@prisma/client';

interface Category {
  id: string;
  name: string;
}

interface ExpenseItem {
  id: string;
  voucherNumber: string;
  title: string;
  amount: string | number;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  vendorName: string | null;
  receiptRef: string | null;
  status: ExpenseStatus;
  voidReason: string | null;
  category: { id: string; name: string };
  createdAt: string;
}

interface ExpenseSummary {
  thisMonthTotal: string | number;
  thisYearTotal: string | number;
  thisMonthCount: number;
  thisYearCount: number;
}

interface ExpenseListProps {
  initialExpenses: ExpenseItem[];
  initialSummary: ExpenseSummary;
  categories: Category[];
}

export default function ExpenseList({ initialExpenses, initialSummary, categories }: ExpenseListProps) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [summary, setSummary] = useState<ExpenseSummary>(initialSummary);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Void state
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidLoading, setVoidLoading] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set('categoryId', selectedCategory);
      if (selectedMethod) params.set('paymentMethod', selectedMethod);
      if (selectedStatus) params.set('status', selectedStatus);
      if (search) params.set('search', search);

      const res = await fetch(`/api/expenses?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses);
        if (data.summary) setSummary(data.summary);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExpenses();
  };

  const handleVoidClick = (id: string) => {
    setVoidingId(id);
    setVoidReason('');
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!voidingId || !voidReason.trim()) return;
    setVoidLoading(true);

    try {
      const res = await fetch(`/api/expenses/${voidingId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() })
      });

      if (!res.ok) {
        const err = await res.text();
        alert(err || 'Failed to void expense voucher');
        return;
      }

      setIsVoidModalOpen(false);
      setVoidingId(null);
      fetchExpenses();
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setVoidLoading(false);
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
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              <Calendar size={14} className="text-rose-500" />
              <span>Total Expenses This Month</span>
            </div>
            <div className="text-3xl font-extrabold text-rose-600 tracking-tight">
              {formatCurrency(summary.thisMonthTotal)}
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {summary.thisMonthCount} active vouchers posted in current calendar month
            </p>
          </div>
          <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100/80">
            <TrendingDown size={28} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              <DollarSign size={14} className="text-slate-500" />
              <span>Total Expenses This Year</span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatCurrency(summary.thisYearTotal)}
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {summary.thisYearCount} active vouchers posted in current calendar year
            </p>
          </div>
          <div className="p-4 bg-slate-100 text-slate-700 rounded-2xl border border-slate-200/80">
            <Building size={28} />
          </div>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voucher, title, vendor..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-medium"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all bg-white font-medium text-slate-700"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all bg-white font-medium text-slate-700"
          >
            <option value="">All Methods</option>
            <option value={PaymentMethod.CASH}>Cash</option>
            <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
            <option value={PaymentMethod.MTN_MOMO}>MTN MoMo</option>
            <option value={PaymentMethod.AIRTEL_MONEY}>Airtel Money</option>
            <option value={PaymentMethod.CHEQUE}>Cheque</option>
            <option value={PaymentMethod.CARD}>Card</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all bg-white font-medium text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value={ExpenseStatus.COMPLETED}>Completed</option>
            <option value={ExpenseStatus.VOID}>Voided</option>
          </select>

          <Button type="submit" variant="secondary" disabled={loading} className="font-bold gap-2 text-xs h-9">
            <Filter size={14} /> {loading ? 'Filtering...' : 'Filter'}
          </Button>
        </form>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-2 w-full md:w-auto h-9 shadow-sm"
        >
          <Plus size={16} /> Record Expense
        </Button>
      </div>

      {/* Expenses Datatable */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Voucher No</th>
                <th className="py-3.5 px-4">Title & Details</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No operating expenses recorded yet.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-900">
                      {e.voucherNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{e.title}</div>
                      {(e.vendorName || e.receiptRef) && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          {e.vendorName} {e.receiptRef ? `• Ref: ${e.receiptRef}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {e.category.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {new Date(e.expenseDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                        {e.paymentMethod.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {e.status === ExpenseStatus.COMPLETED ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} /> Completed
                        </span>
                      ) : (
                        <span
                          title={e.voidReason || 'Voided'}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                        >
                          <Ban size={12} /> Voided
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {e.status === ExpenseStatus.COMPLETED && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVoidClick(e.id)}
                          className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold"
                        >
                          Void
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Modal */}
      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchExpenses();
          router.refresh();
        }}
        categories={categories}
      />

      {/* Void Dialog */}
      {isVoidModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Void Expense Voucher</h3>
                <p className="text-xs text-slate-500">Non-destructive cancellation of posted disbursement</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mandatory Reason for Voiding *
              </label>
              <textarea
                rows={3}
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Duplicate payment voucher entered in error..."
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsVoidModalOpen(false)} disabled={voidLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmVoid}
                disabled={voidLoading || !voidReason.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {voidLoading ? 'Voiding...' : 'Confirm Void'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
