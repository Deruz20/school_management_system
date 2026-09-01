'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ArrowLeft, Layers, FileText } from 'lucide-react';
import Link from 'next/link';

interface StudentOption {
  id: string;
  name: string;
  admissionNo: string;
  enrollments: {
    id: string;
    classId: string;
    academicYearId: string;
    className: string;
    yearName: string;
  }[];
}

interface FeeTypeOption {
  id: string;
  name: string;
  code: string;
}

interface AcademicYearOption {
  id: string;
  name: string;
  terms: { id: string; name: string }[];
}

interface FeeStructureOption {
  id: string;
  name: string;
  classId: string;
  academicYearId: string;
  termId: string | null;
}

interface CustomItemRow {
  feeTypeId: string;
  feeTypeName: string;
  description: string;
  unitAmount: string;
  quantity: number;
}

export default function IndividualInvoiceForm({
  students,
  feeTypes,
  academicYears,
  feeStructures
}: {
  students: StudentOption[];
  feeTypes: FeeTypeOption[];
  academicYears: AcademicYearOption[];
  feeStructures: FeeStructureOption[];
}) {
  const router = useRouter();

  const [mode, setMode] = useState<'TEMPLATE' | 'CUSTOM'>('TEMPLATE');
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [academicYearId, setAcademicYearId] = useState(academicYears[0]?.id || '');
  const [termId, setTermId] = useState('');
  const [feeStructureId, setFeeStructureId] = useState('');
  const [dueDate, setDueDate] = useState('2026-04-30');
  const [notes, setNotes] = useState('');

  const [customItems, setCustomItems] = useState<CustomItemRow[]>([
    {
      feeTypeId: feeTypes[0]?.id || '',
      feeTypeName: feeTypes[0]?.name || 'Tuition',
      description: '',
      unitAmount: '500000',
      quantity: 1
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedStudent = students.find((s) => s.id === studentId);
  const studentEnrollments = selectedStudent?.enrollments || [];
  const selectedEnrollment =
    studentEnrollments.find((e) => e.academicYearId === academicYearId) || studentEnrollments[0];

  const selectedYear = academicYears.find((y) => y.id === academicYearId);
  const availableTerms = selectedYear ? selectedYear.terms : [];

  const handleAddCustomItem = () => {
    setCustomItems([
      ...customItems,
      {
        feeTypeId: feeTypes[0]?.id || '',
        feeTypeName: feeTypes[0]?.name || 'Item',
        description: '',
        unitAmount: '100000',
        quantity: 1
      }
    ]);
  };

  const handleRemoveCustomItem = (idx: number) => {
    setCustomItems(customItems.filter((_, i) => i !== idx));
  };

  const handleCustomItemChange = (idx: number, field: keyof CustomItemRow, val: string | number) => {
    setCustomItems(
      customItems.map((item, i) => {
        if (i !== idx) return item;
        if (field === 'feeTypeId') {
          const ft = feeTypes.find((f) => f.id === val);
          return { ...item, feeTypeId: val as string, feeTypeName: ft?.name || item.feeTypeName };
        }
        return { ...item, [field]: val };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!selectedEnrollment) {
        throw new Error(
          'Selected student does not have an active enrollment for the chosen academic period.'
        );
      }
      if (!dueDate) throw new Error('Please select an invoice due date.');

      interface InvoicePayload {
        studentId: string;
        enrollmentId: string;
        academicYearId: string;
        termId: string | null;
        dueDate: string;
        notes: string | null;
        feeStructureId?: string;
        items?: Array<{
          feeTypeId: string | null;
          feeTypeName: string;
          description: string | null;
          unitAmount: number;
          quantity: number;
        }>;
      }

      const payload: InvoicePayload = {
        studentId,
        enrollmentId: selectedEnrollment.id,
        academicYearId,
        termId: termId || null,
        dueDate,
        notes: notes.trim() || null
      };

      if (mode === 'TEMPLATE') {
        if (!feeStructureId) throw new Error('Please select a fee structure blueprint.');
        payload.feeStructureId = feeStructureId;
      } else {
        if (customItems.length === 0) throw new Error('Add at least one line item.');
        payload.items = customItems.map((item) => ({
          feeTypeId: item.feeTypeId || null,
          feeTypeName: item.feeTypeName.trim(),
          description: item.description?.trim() || null,
          unitAmount: parseFloat(item.unitAmount) || 0,
          quantity: item.quantity
        }));
      }

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to create invoice.');
      }

      const created = await res.json();
      router.push(`/finance/invoices/${created.id}`);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/finance/invoices">
          <Button variant="outline" size="sm" className="h-9 w-9 p-0">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create Individual Invoice
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Issue a student invoice from a class fee structure blueprint or create custom bill
            items.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 text-sm rounded-xl bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setMode('TEMPLATE')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === 'TEMPLATE'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={14} />
          <span>From Fee Structure Blueprint</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('CUSTOM')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === 'CUSTOM'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText size={14} />
          <span>Custom Ad-Hoc Line Items</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Student <span className="text-red-500">*</span>
          </label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.admissionNo})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <select
              value={academicYearId}
              onChange={(e) => {
                setAcademicYearId(e.target.value);
                setTermId('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Term (Optional)
            </label>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Terms / Annual</option>
              {availableTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mode === 'TEMPLATE' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fee Structure Blueprint <span className="text-red-500">*</span>
            </label>
            <select
              value={feeStructureId}
              onChange={(e) => setFeeStructureId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Select fee structure blueprint --</option>
              {feeStructures.map((fs) => (
                <option key={fs.id} value={fs.id}>
                  {fs.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Custom Invoice Line Items
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomItem}
                className="h-8 text-xs inline-flex items-center gap-1"
              >
                <Plus size={14} />
                <span>Add Item</span>
              </Button>
            </div>

            <div className="space-y-3">
              {customItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                >
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Fee Head
                    </label>
                    <select
                      value={item.feeTypeId}
                      onChange={(e) => handleCustomItemChange(idx, 'feeTypeId', e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Custom Item</option>
                      {feeTypes.map((ft) => (
                        <option key={ft.id} value={ft.id}>
                          {ft.name} ({ft.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Item Name
                    </label>
                    <input
                      type="text"
                      value={item.feeTypeName}
                      onChange={(e) => handleCustomItemChange(idx, 'feeTypeName', e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Unit Amount (UGX)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={item.unitAmount}
                      onChange={(e) => handleCustomItemChange(idx, 'unitAmount', e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      required
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleCustomItemChange(idx, 'quantity', parseInt(e.target.value) || 1)
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      required
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveCustomItem(idx)}
                      disabled={customItems.length <= 1}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Ad-hoc Uniform invoice"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <Link href="/finance/invoices">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating Invoice...' : 'Issue Invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}
