'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, CheckCircle, UserCheck, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentCandidate {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  schoolPayCode?: string | null;
  className: string;
  streamName?: string;
  matchScore: number;
}

interface SchoolPayTransactionData {
  id: string;
  schoolPayReceiptNo: string;
  transactionId: string;
  schoolPayCode: string;
  amount: string | number;
  payerName?: string | null;
  payerPhone?: string | null;
  channel: string;
  paymentDate: string;
}

interface SchoolPayAssignModalProps {
  isOpen: boolean;
  transaction: SchoolPayTransactionData | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SchoolPayAssignModal({
  isOpen,
  transaction,
  onClose,
  onSuccess
}: SchoolPayAssignModalProps) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<StudentCandidate[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentCandidate | null>(null);
  const [linkCode, setLinkCode] = useState(true);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const searchStudents = useCallback(async (q: string, payerName?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (payerName) params.set('payerName', payerName);

      const res = await fetch(`/api/schoolpay/students-search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
        if (data.length > 0 && data[0].matchScore >= 40) {
          setSelectedStudent(data[0]);
        }
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !transaction) return;
    const initialQuery = transaction.payerName || transaction.schoolPayCode || '';
    let cancelled = false;

    const doInitialSearch = async () => {
      try {
        const params = new URLSearchParams();
        if (initialQuery) params.set('q', initialQuery);
        if (transaction.payerName) params.set('payerName', transaction.payerName);

        const res = await fetch(`/api/schoolpay/students-search?${params.toString()}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCandidates(data);
          if (data.length > 0 && data[0].matchScore >= 40) {
            setSelectedStudent(data[0]);
          }
        }
      } catch {
        // Ignored
      }
    };

    doInitialSearch();
    return () => {
      cancelled = true;
    };
  }, [isOpen, transaction]);

  const handleSearchChange = (val: string) => {
    setQuery(val);
    searchStudents(val, transaction?.payerName || undefined);
  };

  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction || !selectedStudent) {
      setError('Please select a student to assign this payment.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/schoolpay/${transaction.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          linkSchoolPayCode: linkCode,
          reviewNotes: notes.trim() || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to assign transaction');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign transaction';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Match Payment to Student
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Receipt: <span className="font-mono font-semibold text-slate-700">{transaction.schoolPayReceiptNo}</span> · Amount: <span className="font-bold text-emerald-700">UGX {Number(transaction.amount).toLocaleString()}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {/* Transaction Metadata Card */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Payer Name:</span>
              <span className="font-bold text-slate-900">{transaction.payerName || 'Not recorded'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Submitted Code:</span>
              <span className="font-mono font-semibold text-slate-900">{transaction.schoolPayCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Payment Channel:</span>
              <span className="font-semibold text-slate-800">{transaction.channel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Payment Date:</span>
              <span className="text-slate-700">{new Date(transaction.paymentDate).toLocaleString()}</span>
            </div>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Search Enrolled Student
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search student name, admission no, or class..."
                className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
            </div>
          </div>

          {/* Student Candidate Selection List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-100 rounded-xl p-1 bg-slate-50/50">
            {loading ? (
              <p className="text-center py-4 text-xs text-slate-400">Searching students...</p>
            ) : candidates.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-400">No active students found matching &quot;{query}&quot;</p>
            ) : (
              candidates.map((c) => {
                const isSelected = selectedStudent?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedStudent(c)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400/50'
                        : 'bg-white border-slate-200/60 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">
                          {c.firstName} {c.lastName}
                        </span>
                        {c.matchScore >= 40 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            <Sparkles size={10} /> Suggested ({c.matchScore}%)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Adm: {c.admissionNo}</span>
                        <span>·</span>
                        <span>Class: {c.className} {c.streamName}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Confirmation Box */}
          {selectedStudent && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-900">
              <UserCheck size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold">
                  Assigning to: {selectedStudent.firstName} {selectedStudent.lastName} ({selectedStudent.admissionNo})
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  The payment of UGX {Number(transaction.amount).toLocaleString()} will be posted to the student&apos;s subledger and allocated via FIFO to active term invoices.
                </p>
              </div>
            </div>
          )}

          {/* Link Code Checkbox */}
          <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={linkCode}
              onChange={(e) => setLinkCode(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 mt-0.5"
            />
            <span>
              Link student to SchoolPay Code <code className="font-mono bg-slate-100 px-1 rounded text-slate-900">{transaction.schoolPayCode}</code> so future payments match automatically.
            </span>
          </label>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Bursar Resolution Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Verified with parent by phone..."
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs h-9 font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedStudent || submitting}
            onClick={handleConfirmAssign}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 shadow-sm"
          >
            {submitting ? 'Posting...' : 'Confirm & Post to Ledger'}
          </Button>
        </div>
      </div>
    </div>
  );
}
