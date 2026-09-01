'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Plus, Trash2, Edit2, Percent, DollarSign, Award } from 'lucide-react';
import { DiscountType } from '@prisma/client';

interface StudentOption {
  id: string;
  name: string;
  admissionNo: string;
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

interface DiscountItem {
  id: string;
  studentId: string;
  feeTypeId: string | null;
  academicYearId: string | null;
  termId: string | null;
  discountType: DiscountType;
  value: string | number | { toString(): string };
  reason: string;
  isActive: boolean;
  student: { id: string; firstName: string; lastName: string; admissionNo: string };
  feeType: { id: string; name: string; code: string } | null;
  academicYear: { id: string; name: string } | null;
  term: { id: string; name: string } | null;
}

export default function DiscountList({
  initialDiscounts,
  students,
  feeTypes,
  academicYears
}: {
  initialDiscounts: DiscountItem[];
  students: StudentOption[];
  feeTypes: FeeTypeOption[];
  academicYears: AcademicYearOption[];
}) {
  const router = useRouter();
  const [discounts, setDiscounts] = useState<DiscountItem[]>(initialDiscounts);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountItem | null>(null);

  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [feeTypeId, setFeeTypeId] = useState<string>('');
  const [academicYearId, setAcademicYearId] = useState<string>('');
  const [termId, setTermId] = useState<string>('');
  const [discountType, setDiscountType] = useState<DiscountType>(DiscountType.PERCENTAGE);
  const [value, setValue] = useState<string>('50');
  const [reason, setReason] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedYear = academicYears.find((y) => y.id === academicYearId);
  const availableTerms = selectedYear ? selectedYear.terms : [];

  const handleOpenCreate = () => {
    setEditingDiscount(null);
    setStudentId(students[0]?.id || '');
    setFeeTypeId('');
    setAcademicYearId('');
    setTermId('');
    setDiscountType(DiscountType.PERCENTAGE);
    setValue('50');
    setReason('');
    setIsActive(true);
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (d: DiscountItem) => {
    setEditingDiscount(d);
    setStudentId(d.studentId);
    setFeeTypeId(d.feeTypeId || '');
    setAcademicYearId(d.academicYearId || '');
    setTermId(d.termId || '');
    setDiscountType(d.discountType);
    setValue(d.value.toString());
    setReason(d.reason);
    setIsActive(d.isActive);
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!reason.trim()) {
        throw new Error('Please enter a reason or bursary description.');
      }
      const numVal = parseFloat(value);
      if (isNaN(numVal) || numVal <= 0) {
        throw new Error('Please enter a positive discount value.');
      }
      if (discountType === DiscountType.PERCENTAGE && numVal > 100) {
        throw new Error('Percentage discount cannot exceed 100%.');
      }

      const payload = {
        studentId,
        feeTypeId: feeTypeId || null,
        academicYearId: academicYearId || null,
        termId: termId || null,
        discountType,
        value: numVal,
        reason: reason.trim(),
        isActive
      };

      let res;
      if (editingDiscount) {
        res = await fetch(`/api/discounts/${editingDiscount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to save discount rule.');
      }

      const saved = await res.json();
      if (editingDiscount) {
        setDiscounts(discounts.map((d) => (d.id === saved.id ? saved : d)));
      } else {
        setDiscounts([saved, ...discounts]);
      }

      setModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this student discount rule?')) return;

    try {
      const res = await fetch(`/api/discounts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const txt = await res.text();
        alert(txt || 'Failed to delete discount.');
        return;
      }
      setDiscounts(discounts.filter((d) => d.id !== id));
      router.refresh();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Student Discounts &amp; Bursaries
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage student bursaries, staff child concessions, and academic merit fee discounts.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="inline-flex items-center gap-2">
          <Plus size={16} />
          <span>New Discount / Bursary</span>
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Target Fee Head</TableHead>
              <TableHead>Applicable Period</TableHead>
              <TableHead>Discount Value</TableHead>
              <TableHead>Reason / Scheme</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Award size={32} className="text-slate-300" />
                    <p className="font-medium text-slate-700">No discount rules configured</p>
                    <p className="text-xs text-slate-400">
                      Click &quot;New Discount / Bursary&quot; to assign a fee reduction to a student.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              discounts.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-slate-900">
                    <div>
                      {d.student.firstName} {d.student.lastName}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">{d.student.admissionNo}</div>
                  </TableCell>
                  <TableCell>
                    {d.feeType ? (
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {d.feeType.code} ({d.feeType.name})
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        Entire Bill / All Items
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-slate-800">
                      {d.academicYear?.name || 'All Years'}
                    </div>
                    <div className="text-xs text-slate-500">{d.term?.name || 'All Terms'}</div>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900 font-mono">
                    {d.discountType === DiscountType.PERCENTAGE ? (
                      <span className="text-emerald-700">{Number(d.value)}% OFF</span>
                    ) : (
                      <span className="text-blue-700">
                        UGX {Number(d.value).toLocaleString()} OFF
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-700 text-sm max-w-xs truncate">
                    {d.reason}
                  </TableCell>
                  <TableCell>
                    {d.isActive ? (
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(d)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(d.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900">
              {editingDiscount ? 'Edit Discount / Bursary' : 'Assign Student Discount / Bursary'}
            </h2>

            {error && (
              <div className="p-3 text-sm rounded bg-red-50 text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student <span className="text-red-500">*</span>
                </label>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={!!editingDiscount}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
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
                    Target Fee Head
                  </label>
                  <select
                    value={feeTypeId}
                    onChange={(e) => setFeeTypeId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Fee Heads (Entire Bill)</option>
                    {feeTypes.map((ft) => (
                      <option key={ft.id} value={ft.id}>
                        {ft.name} ({ft.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discount Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDiscountType(DiscountType.PERCENTAGE)}
                      className={`flex items-center justify-center gap-1 py-2 text-xs font-medium rounded-lg border ${
                        discountType === DiscountType.PERCENTAGE
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      <Percent size={14} />
                      <span>Percentage</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType(DiscountType.FIXED_AMOUNT)}
                      className={`flex items-center justify-center gap-1 py-2 text-xs font-medium rounded-lg border ${
                        discountType === DiscountType.FIXED_AMOUNT
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      <DollarSign size={14} />
                      <span>Fixed Amount</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Academic Year (Optional)
                  </label>
                  <select
                    value={academicYearId}
                    onChange={(e) => {
                      setAcademicYearId(e.target.value);
                      setTermId('');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Academic Years</option>
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
                    disabled={!academicYearId}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  >
                    <option value="">All Terms</option>
                    {availableTerms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Discount Value {discountType === DiscountType.PERCENTAGE ? '(%)' : '(UGX)'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step={discountType === DiscountType.PERCENTAGE ? '0.01' : '1'}
                  max={discountType === DiscountType.PERCENTAGE ? '100' : undefined}
                  min="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder={discountType === DiscountType.PERCENTAGE ? '50' : '200000'}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Bursary Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Staff Child 50% Concession, Merit Scholarship"
                  required
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveDiscount"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActiveDiscount" className="text-sm font-medium text-slate-700">
                  Active Discount Rule
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : editingDiscount ? 'Update Rule' : 'Create Rule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
