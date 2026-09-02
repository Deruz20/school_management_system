'use client';

import React, { useState } from 'react';

interface BudgetItemDetail {
  id: string;
  code: string;
  name: string;
  type: 'EXPENSE_VOTE_HEAD' | 'REVENUE_TARGET';
  allocatedAmount: string;
}

interface BudgetRevisionModalProps {
  budgetId: string;
  items: BudgetItemDetail[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BudgetRevisionModal({
  budgetId,
  items,
  isOpen,
  onClose,
  onSuccess,
}: BudgetRevisionModalProps) {
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDeltaChange = (itemId: string, val: string) => {
    setDeltas((prev) => ({ ...prev, [itemId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Revision title is required.');
      return;
    }
    if (!reason.trim()) {
      setError('A justification reason is required for audit compliance.');
      return;
    }

    const revisionItems = Object.entries(deltas)
      .map(([budgetItemId, val]) => {
        const delta = parseFloat(val);
        if (isNaN(delta) || delta === 0) return null;
        return { budgetItemId, deltaAmount: delta };
      })
      .filter((item): item is { budgetItemId: string; deltaAmount: number } => item !== null);

    if (revisionItems.length === 0) {
      setError('Please specify at least one non-zero adjustment delta.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/budgets/${budgetId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          reason: reason.trim(),
          items: revisionItems,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to submit revision');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Prepare Supplementary Revision</h2>
            <p className="text-xs text-gray-500">
              Adjust approved vote head allocations with versioned Four-Eye audit trail.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Revision Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Supplementary Allocation - Term 2 Fuel Provisions"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Justification &amp; Authority *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Approved by Finance Committee resolution #42 due to generator diesel price increase."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Adjust Vote Head Allocations (Delta Amount in UGX)
            </label>
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Vote Head</th>
                    <th className="py-2 px-3 text-right">Current (UGX)</th>
                    <th className="py-2 px-3 w-36 text-right">Adjustment (+/-)</th>
                    <th className="py-2 px-3 text-right">New Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => {
                    const current = parseFloat(item.allocatedAmount) || 0;
                    const delta = parseFloat(deltas[item.id] || '0') || 0;
                    const newTotal = current + delta;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-gray-900">{item.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{item.code}</div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-gray-600">
                          {current.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={deltas[item.id] || ''}
                            onChange={(e) => handleDeltaChange(item.id, e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1 text-right text-xs border border-gray-300 rounded font-mono font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          />
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold ${
                            newTotal < 0 ? 'text-rose-600' : 'text-gray-900'
                          }`}
                        >
                          {newTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Revision...' : 'Submit Revision Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
