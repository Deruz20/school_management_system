'use client';

import { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  Ban,
  Search,
  RefreshCw,
  Eye,
  Check,
  UserPlus,
  RotateCcw,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import SchoolPayAssignModal from './SchoolPayAssignModal';

interface SchoolPayStats {
  postedCount: number;
  postedAmount: string;
  needsReviewCount: number;
  needsReviewAmount: string;
  matchedCount: number;
  matchedAmount: string;
  ignoredCount: number;
  ignoredAmount: string;
  failedCount: number;
  totalLinkedStudents: number;
  totalActiveStudents: number;
}

interface SchoolPayTxRow {
  id: string;
  schoolPayReceiptNo: string;
  transactionId: string;
  schoolPayCode: string;
  amount: string | number;
  feeAmount?: string | number | null;
  payerName?: string | null;
  payerPhone?: string | null;
  channel: string;
  paymentDate: string;
  status: 'RECEIVED' | 'MATCHED' | 'POSTED' | 'NEEDS_REVIEW' | 'IGNORED' | 'FAILED';
  errorMessage?: string | null;
  reviewNotes?: string | null;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNo: string;
    classRef?: { name: string };
    streamRef?: { name: string };
  } | null;
  payment?: {
    id: string;
    paymentNumber: string;
    receipt?: { receiptNumber: string } | null;
  } | null;
  rawPayload?: Record<string, unknown> | null;
}

interface SchoolPayReconciliationTableProps {
  initialTransactions: SchoolPayTxRow[];
  initialStats: SchoolPayStats;
  initialTotal: number;
  onRefresh?: () => void;
}

export default function SchoolPayReconciliationTable({
  initialTransactions,
  initialStats,
  onRefresh
}: SchoolPayReconciliationTableProps) {
  const [transactions, setTransactions] = useState<SchoolPayTxRow[]>(initialTransactions);
  const [stats, setStats] = useState<SchoolPayStats>(initialStats);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync date range
  const [syncFrom, setSyncFrom] = useState('2026-01-01');
  const [syncTo, setSyncTo] = useState('2026-12-31');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Modals state
  const [assignModalTx, setAssignModalTx] = useState<SchoolPayTxRow | null>(null);
  const [payloadModalTx, setPayloadModalTx] = useState<SchoolPayTxRow | null>(null);
  const [ignoreModalTx, setIgnoreModalTx] = useState<SchoolPayTxRow | null>(null);
  const [ignoreReason, setIgnoreReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search) params.set('search', search);
      if (channelFilter) params.set('channel', channelFilter);

      const res = await fetch(`/api/schoolpay/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        if (data.stats) setStats(data.stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions();
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/schoolpay/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: syncFrom, to: syncTo })
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`Sync completed: ${data.totalFetched} fetched, ${data.newReceived} new (${data.autoPosted} auto-posted, ${data.needsReview} queued for review).`);
        fetchTransactions();
        onRefresh?.();
      } else {
        setSyncMessage(`Sync error: ${data.error || 'Failed to sync'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setSyncMessage(`Network error: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  const handle1ClickPost = async (txId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/schoolpay/${txId}/post`, { method: 'POST' });
      if (res.ok) {
        fetchTransactions();
        onRefresh?.();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to post transaction');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async (txId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/schoolpay/${txId}/retry`, { method: 'POST' });
      if (res.ok) {
        fetchTransactions();
        onRefresh?.();
      } else {
        const err = await res.json();
        alert(err.error || 'Retry failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Retry failed';
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmIgnore = async () => {
    if (!ignoreModalTx || !ignoreReason.trim() || ignoreReason.trim().length < 5) {
      alert('A valid reason of at least 5 characters is required.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/schoolpay/${ignoreModalTx.id}/ignore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: ignoreReason.trim() })
      });
      if (res.ok) {
        setIgnoreModalTx(null);
        setIgnoreReason('');
        fetchTransactions();
        onRefresh?.();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to ignore transaction');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const formatChannel = (ch: string) => {
    return ch.replace('_', ' ');
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP METRIC STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Posted Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Posted to Ledger
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900">
              UGX {Number(stats.postedAmount).toLocaleString()}
            </h3>
            <p className="text-xs font-semibold text-emerald-700 mt-1">
              {stats.postedCount} transactions reconciled & posted
            </p>
          </div>
        </div>

        {/* Needs Review Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Needs Review
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900">
              UGX {Number(stats.needsReviewAmount).toLocaleString()}
            </h3>
            <p className="text-xs font-semibold text-amber-700 mt-1">
              {stats.needsReviewCount} unmatched / ambiguous in queue
            </p>
          </div>
        </div>

        {/* Matched Unposted Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Matched Unposted
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900">
              UGX {Number(stats.matchedAmount).toLocaleString()}
            </h3>
            <p className="text-xs font-semibold text-blue-700 mt-1">
              {stats.matchedCount} awaiting 1-click posting
            </p>
          </div>
        </div>

        {/* Dismissed / Ignored Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Ignored / Dismissed
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Ban size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900">
              UGX {Number(stats.ignoredAmount).toLocaleString()}
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              {stats.ignoredCount} test / erroneous transactions
            </p>
          </div>
        </div>
      </div>

      {/* 2. BATCH SYNC & PULL TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Batch Sync Date Range:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">From:</span>
              <input
                type="date"
                value={syncFrom}
                onChange={(e) => setSyncFrom(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">To:</span>
              <input
                type="date"
                value={syncTo}
                onChange={(e) => setSyncTo(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <Button
              type="button"
              disabled={syncing}
              onClick={handleSync}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-8 px-4 gap-1.5"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Range Now'}
            </Button>
          </div>
        </div>

        {syncMessage && (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium">
            {syncMessage}
          </div>
        )}
      </div>

      {/* 3. SEARCH & RECONCILIATION FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipt, payer name, student, phone, or code..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white text-slate-700"
          >
            <option value="ALL">All Statuses ({transactions.length})</option>
            <option value="NEEDS_REVIEW">Needs Review ({stats.needsReviewCount})</option>
            <option value="POSTED">Posted ({stats.postedCount})</option>
            <option value="MATCHED">Matched Unposted ({stats.matchedCount})</option>
            <option value="IGNORED">Ignored ({stats.ignoredCount})</option>
            <option value="FAILED">Failed ({stats.failedCount})</option>
          </select>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white text-slate-700"
          >
            <option value="">All Channels</option>
            <option value="STANBIC_BANK">Stanbic Bank</option>
            <option value="CENTENARY_BANK">Centenary Bank</option>
            <option value="ABSA_BANK">Absa Bank</option>
            <option value="DFCU_BANK">DFCU Bank</option>
            <option value="POST_BANK">PostBank</option>
            <option value="EQUITY_BANK">Equity Bank</option>
            <option value="MTN_MOMO">MTN MoMo</option>
            <option value="AIRTEL_MONEY">Airtel Money</option>
          </select>

          <Button
            type="submit"
            variant="secondary"
            disabled={loading}
            className="font-bold text-xs h-8 px-4"
          >
            {loading ? 'Filtering...' : 'Filter'}
          </Button>
        </form>
      </div>

      {/* 4. RECONCILIATION DATATABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Date & Channel</th>
                <th className="py-3 px-4">Receipt / Ref</th>
                <th className="py-3 px-4">Payer & Code</th>
                <th className="py-3 px-4 text-right">Amount (UGX)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Matched Student</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No SchoolPay transactions found matching the selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const isPosted = t.status === 'POSTED';
                  const isNeedsReview = t.status === 'NEEDS_REVIEW';
                  const isMatched = t.status === 'MATCHED';
                  const isIgnored = t.status === 'IGNORED';
                  const isFailed = t.status === 'FAILED';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Date & Channel */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {new Date(t.paymentDate).toLocaleDateString()}
                        </div>
                        <span className="inline-block mt-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {formatChannel(t.channel)}
                        </span>
                      </td>

                      {/* Receipt & Bank Ref */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">
                          {t.schoolPayReceiptNo}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate max-w-[140px]" title={t.transactionId}>
                          {t.transactionId}
                        </div>
                      </td>

                      {/* Payer & Code */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{t.payerName || 'Unknown Payer'}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-semibold bg-slate-100 px-1 rounded text-slate-700">
                            {t.schoolPayCode}
                          </span>
                          {t.payerPhone && <span>· {t.payerPhone}</span>}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                        {Number(t.amount).toLocaleString()}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center">
                        {isPosted && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Check size={12} /> Posted
                          </span>
                        )}
                        {isNeedsReview && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <AlertTriangle size={12} /> Needs Review
                          </span>
                        )}
                        {isMatched && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            <Clock size={12} /> Matched Unposted
                          </span>
                        )}
                        {isIgnored && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <Ban size={12} /> Ignored
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <AlertCircle size={12} /> Failed
                          </span>
                        )}
                      </td>

                      {/* Matched Student */}
                      <td className="py-3 px-4">
                        {t.student ? (
                          <div>
                            <div className="font-bold text-slate-900">
                              {t.student.firstName} {t.student.lastName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {t.student.admissionNo} · {t.student.classRef?.name || ''}
                            </div>
                            {t.payment?.receipt && (
                              <div className="text-[10px] font-mono text-emerald-700 font-semibold mt-0.5">
                                Rcpt: {t.payment.receipt.receiptNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-400 italic text-[11px]">
                            {t.errorMessage ? (
                              <span className="text-amber-700 font-medium not-italic" title={t.errorMessage}>
                                {t.errorMessage.slice(0, 35)}...
                              </span>
                            ) : (
                              'Not matched'
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {isMatched && (
                          <Button
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => handle1ClickPost(t.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] h-7 px-2.5 gap-1"
                          >
                            <Check size={12} /> Post
                          </Button>
                        )}

                        {(isNeedsReview || isFailed || (!isPosted && !isIgnored)) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={actionLoading}
                            onClick={() => setAssignModalTx(t)}
                            className="font-bold text-[11px] h-7 px-2.5 gap-1"
                          >
                            <UserPlus size={12} /> Assign
                          </Button>
                        )}

                        {isFailed && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={actionLoading}
                            onClick={() => handleRetry(t.id)}
                            className="font-bold text-[11px] h-7 px-2 gap-1 text-rose-700 hover:bg-rose-50"
                            title="Retry Processing"
                          >
                            <RotateCcw size={12} />
                          </Button>
                        )}

                        {!isPosted && !isIgnored && (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => {
                              setIgnoreModalTx(t);
                              setIgnoreReason('');
                            }}
                            className="text-[11px] text-slate-400 hover:text-slate-700 font-semibold px-1.5 py-1"
                          >
                            Ignore
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setPayloadModalTx(t)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors align-middle"
                          title="View Gateway Payload"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. ASSIGN MODAL */}
      <SchoolPayAssignModal
        isOpen={Boolean(assignModalTx)}
        transaction={assignModalTx}
        onClose={() => setAssignModalTx(null)}
        onSuccess={() => {
          fetchTransactions();
          onRefresh?.();
        }}
      />

      {/* 6. RAW PAYLOAD MODAL */}
      {payloadModalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">
                Raw Gateway Payload ({payloadModalTx.schoolPayReceiptNo})
              </h3>
              <button
                onClick={() => setPayloadModalTx(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-xs text-slate-800 bg-slate-950 text-emerald-400 p-4 rounded-b-2xl">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(payloadModalTx.rawPayload || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 7. IGNORE CONFIRMATION MODAL */}
      {ignoreModalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Dismiss / Ignore SchoolPay Transaction
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Receipt: <span className="font-mono font-semibold">{ignoreModalTx.schoolPayReceiptNo}</span> · Amount: <span className="font-bold">UGX {Number(ignoreModalTx.amount).toLocaleString()}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reason for Dismissal *
              </label>
              <textarea
                required
                rows={3}
                value={ignoreReason}
                onChange={(e) => setIgnoreReason(e.target.value)}
                placeholder="e.g. Test transaction sent during setup, or duplicate voucher..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIgnoreModalTx(null)}
                className="text-xs h-8 font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={actionLoading || ignoreReason.trim().length < 5}
                onClick={handleConfirmIgnore}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-8 px-4 shadow-sm"
              >
                {actionLoading ? 'Saving...' : 'Confirm Ignore'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
