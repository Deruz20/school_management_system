'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ClassOption {
  id: string;
  name: string;
}

interface AcademicYearOption {
  id: string;
  name: string;
  terms: { id: string; name: string }[];
}

interface FeeTypeOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface ItemRow {
  feeTypeId: string;
  amount: number | string;
  isOptional: boolean;
  dueDate: string;
  description: string;
}

export default function FeeStructureForm({
  classes,
  academicYears,
  feeTypes,
  initialData
}: {
  classes: ClassOption[];
  academicYears: AcademicYearOption[];
  feeTypes: FeeTypeOption[];
  initialData?: {
    id: string;
    name: string;
    classId: string;
    academicYearId: string;
    termId: string | null;
    description: string | null;
    currency: string;
    isActive: boolean;
    items: {
      id: string;
      feeTypeId: string;
      amount: number | string | { toString(): string };
      isOptional: boolean;
      dueDate: Date | string | null;
      description: string | null;
    }[];
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState(initialData?.name || '');
  const [classId, setClassId] = useState(initialData?.classId || (classes[0]?.id ?? ''));
  const [academicYearId, setAcademicYearId] = useState(
    initialData?.academicYearId || (academicYears[0]?.id ?? '')
  );
  const [termId, setTermId] = useState(initialData?.termId || '');
  const [currency, setCurrency] = useState(initialData?.currency || 'UGX');
  const [description, setDescription] = useState(initialData?.description || '');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const [items, setItems] = useState<ItemRow[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items.map((i) => ({
          feeTypeId: i.feeTypeId,
          amount: i.amount.toString(),
          isOptional: i.isOptional,
          dueDate: i.dueDate ? new Date(i.dueDate).toISOString().split('T')[0] : '',
          description: i.description || ''
        }))
      : [
          {
            feeTypeId: feeTypes[0]?.id || '',
            amount: '',
            isOptional: false,
            dueDate: '',
            description: ''
          }
        ]
  );

  const selectedYear = academicYears.find((y) => y.id === academicYearId);
  const availableTerms = selectedYear ? selectedYear.terms : [];

  const handleAddItem = () => {
    // Pick the first unused fee type if available
    const usedIds = new Set(items.map((i) => i.feeTypeId));
    const nextUnused = feeTypes.find((f) => !usedIds.has(f.id));
    setItems([
      ...items,
      {
        feeTypeId: nextUnused ? nextUnused.id : (feeTypes[0]?.id ?? ''),
        amount: '',
        isOptional: false,
        dueDate: '',
        description: ''
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('A fee structure must contain at least one fee item.');
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemRow, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const totalAmount = items.reduce((sum, item) => {
    const amt = parseFloat(String(item.amount)) || 0;
    return sum + amt;
  }, 0);

  const mandatoryTotal = items.reduce((sum, item) => {
    if (item.isOptional) return sum;
    const amt = parseFloat(String(item.amount)) || 0;
    return sum + amt;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validations
    if (!name.trim()) {
      setError('Structure name is required.');
      setLoading(false);
      return;
    }

    if (items.length === 0) {
      setError('At least one fee item is required.');
      setLoading(false);
      return;
    }

    const feeTypeIds = items.map((i) => i.feeTypeId);
    if (new Set(feeTypeIds).size !== feeTypeIds.length) {
      setError('Duplicate fee types detected. Each fee type can only appear once in a structure.');
      setLoading(false);
      return;
    }

    for (const item of items) {
      if (!item.feeTypeId) {
        setError('Please select a fee type for all rows.');
        setLoading(false);
        return;
      }
      const amt = parseFloat(String(item.amount));
      if (isNaN(amt) || amt < 0) {
        setError('Fee item amounts must be valid non-negative numbers.');
        setLoading(false);
        return;
      }
    }

    const payload = {
      name: name.trim(),
      classId,
      academicYearId,
      termId: termId || null,
      currency,
      description: description.trim() || null,
      isActive,
      items: items.map((i) => ({
        feeTypeId: i.feeTypeId,
        amount: parseFloat(String(i.amount)),
        isOptional: !!i.isOptional,
        dueDate: i.dueDate ? new Date(i.dueDate).toISOString() : null,
        description: i.description?.trim() || null
      }))
    };

    try {
      const url = initialData ? `/api/fee-structures/${initialData.id}` : '/api/fee-structures';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to save fee structure');
      }

      router.push('/finance/fee-structures');
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      <div className="flex items-center justify-between">
        <Link href="/finance/fee-structures" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft size={16} />
          <span>Back to Fee Structures</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => router.push('/finance/fee-structures')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : initialData ? 'Save Changes' : 'Create Structure'}
          </Button>
        </div>
      </div>

      {/* Structure Context & Metadata */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
          Structure Overview
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Structure Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. S.1 Term 1 Standard Fees"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Class *</label>
            <select
              required
              disabled={!!initialData}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Academic Year *</label>
            <select
              required
              disabled={!!initialData}
              value={academicYearId}
              onChange={(e) => {
                setAcademicYearId(e.target.value);
                setTermId('');
              }}
              className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Term (Optional / Specific Term)</label>
            <select
              disabled={!!initialData}
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">All Terms / Annual</option>
              {availableTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Currency</label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="w-full p-2 border border-slate-300 rounded-md text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            rows={2}
            placeholder="Optional notes or billing instructions..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isActiveStructure"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isActiveStructure" className="text-sm font-medium text-slate-700">
            Active fee structure
          </label>
        </div>
      </div>

      {/* Fee Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Fee Items & Rates</h2>
            <p className="text-xs text-slate-500">Configure fee heads and amounts for this blueprint.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="gap-1.5">
            <Plus size={14} />
            <span>Add Fee Item</span>
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <div className="md:col-span-4 space-y-1">
                <label className="text-xs font-medium text-slate-600 md:hidden">Fee Type</label>
                <select
                  required
                  value={item.feeTypeId}
                  onChange={(e) => handleItemChange(index, 'feeTypeId', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {feeTypes.map((ft) => (
                    <option key={ft.id} value={ft.id}>
                      {ft.name} ({ft.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="text-xs font-medium text-slate-600 md:hidden">Amount ({currency})</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                    {currency}
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={item.amount}
                    onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                    className="w-full pl-12 pr-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex items-center gap-2 pt-2 md:pt-0">
                <input
                  type="checkbox"
                  id={`opt-${index}`}
                  checked={item.isOptional}
                  onChange={(e) => handleItemChange(index, 'isOptional', e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`opt-${index}`} className="text-xs font-medium text-slate-700">
                  Optional
                </label>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-medium text-slate-600 md:hidden">Due Date</label>
                <input
                  type="date"
                  value={item.dueDate}
                  onChange={(e) => handleItemChange(index, 'dueDate', e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={items.length <= 1}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                  onClick={() => handleRemoveItem(index)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Footer */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-end md:items-center bg-slate-50 p-4 rounded-lg">
          <div className="text-sm text-slate-600 space-y-0.5">
            <div>
              Mandatory Fees Total:{' '}
              <span className="font-semibold text-slate-900 font-mono">
                {mandatoryTotal.toLocaleString()} {currency}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Total items: {items.length} ({items.filter((i) => i.isOptional).length} optional)
            </div>
          </div>
          <div className="text-right mt-2 md:mt-0">
            <div className="text-xs text-slate-500 font-medium">Grand Total (All Items)</div>
            <div className="text-xl font-bold text-blue-700 font-mono">
              {totalAmount.toLocaleString()} {currency}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
