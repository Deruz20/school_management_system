'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Layers, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
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

interface FeeStructureOption {
  id: string;
  name: string;
  classId: string;
  academicYearId: string;
  termId: string | null;
  items: {
    id: string;
    feeTypeId: string;
    amount: number | string | { toString(): string };
    feeType: { name: string; code: string };
  }[];
}

export default function BulkInvoiceForm({
  classes,
  academicYears,
  feeStructures
}: {
  classes: ClassOption[];
  academicYears: AcademicYearOption[];
  feeStructures: FeeStructureOption[];
}) {
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [academicYearId, setAcademicYearId] = useState(academicYears[0]?.id || '');
  const [termId, setTermId] = useState('');
  const [feeStructureId, setFeeStructureId] = useState('');
  const [dueDate, setDueDate] = useState('2026-04-30');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    billedCount: number;
    skippedCount: number;
    totalBilled: string;
    totalDiscount: string;
  } | null>(null);

  const selectedYear = academicYears.find((y) => y.id === academicYearId);
  const availableTerms = selectedYear ? selectedYear.terms : [];

  // Filter applicable fee structures by class & academic period
  const matchingStructures = feeStructures.filter((fs) => {
    if (fs.classId !== classId) return false;
    if (fs.academicYearId !== academicYearId) return false;
    if (termId && fs.termId && fs.termId !== termId) return false;
    return true;
  });

  const selectedStructure = feeStructures.find((fs) => fs.id === feeStructureId);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      if (!classId) throw new Error('Please select a target class.');
      if (!academicYearId) throw new Error('Please select an academic year.');
      if (!feeStructureId) throw new Error('Please select an active fee structure blueprint.');
      if (!dueDate) throw new Error('Please specify an invoice due date.');

      const res = await fetch('/api/invoices/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          academicYearId,
          termId: termId || null,
          feeStructureId,
          dueDate,
          notes: notes.trim() || null
        })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to generate bulk invoices.');
      }

      const data = await res.json();
      setResult(data);
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
            Bulk Class Billing Engine
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Generate term invoices for all enrolled students in a class with automatic bursary &amp;
            discount resolution.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-start gap-3">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Billing Error</h4>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="p-5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 space-y-3">
          <div className="flex items-center gap-2 font-bold text-emerald-900">
            <CheckCircle2 size={20} />
            <span>Bulk Billing Completed Successfully!</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-white/80 p-3 rounded-lg border border-emerald-100">
              <span className="text-slate-500">Invoices Created</span>
              <p className="text-lg font-bold text-emerald-700 font-mono">{result.billedCount}</p>
            </div>
            <div className="bg-white/80 p-3 rounded-lg border border-emerald-100">
              <span className="text-slate-500">Already Billed (Skipped)</span>
              <p className="text-lg font-bold text-slate-700 font-mono">{result.skippedCount}</p>
            </div>
            <div className="bg-white/80 p-3 rounded-lg border border-emerald-100">
              <span className="text-slate-500">Total Billed</span>
              <p className="text-lg font-bold text-slate-900 font-mono">
                UGX {Number(result.totalBilled).toLocaleString()}
              </p>
            </div>
            <div className="bg-white/80 p-3 rounded-lg border border-emerald-100">
              <span className="text-slate-500">Total Discounts</span>
              <p className="text-lg font-bold text-emerald-700 font-mono">
                UGX {Number(result.totalDiscount).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <Link href="/finance/invoices">
              <Button size="sm">View All Invoices</Button>
            </Link>
          </div>
        </div>
      )}

      <form
        onSubmit={handleGenerate}
        className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Class <span className="text-red-500">*</span>
            </label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setFeeStructureId('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <select
              value={academicYearId}
              onChange={(e) => {
                setAcademicYearId(e.target.value);
                setTermId('');
                setFeeStructureId('');
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
              Billing Term (Optional)
            </label>
            <select
              value={termId}
              onChange={(e) => {
                setTermId(e.target.value);
                setFeeStructureId('');
              }}
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

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Fee Structure Blueprint <span className="text-red-500">*</span>
          </label>
          <select
            value={feeStructureId}
            onChange={(e) => setFeeStructureId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            required
          >
            <option value="">-- Select matching fee blueprint --</option>
            {matchingStructures.map((fs) => (
              <option key={fs.id} value={fs.id}>
                {fs.name} ({fs.items.length} items)
              </option>
            ))}
          </select>
          {matchingStructures.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              No fee structure found matching this Class and Academic Period.{' '}
              <Link href="/finance/fee-structures/new" className="underline font-semibold">
                Create one here.
              </Link>
            </p>
          )}
        </div>

        {selectedStructure && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Fee Blueprint Items Snapshot
            </h4>
            <div className="divide-y divide-slate-200">
              {selectedStructure.items.map((it) => (
                <div key={it.id} className="py-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-800 font-medium">
                    {it.feeType.name} ({it.feeType.code})
                  </span>
                  <span className="font-mono text-slate-900 font-bold">
                    UGX {Number(it.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Invoice Due Date <span className="text-red-500">*</span>
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
              Billing Batch Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Standard Term 1 Tuition Invoicing"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <Link href="/finance/invoices">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={loading || !feeStructureId}
            className="inline-flex items-center gap-2"
          >
            <Layers size={16} />
            <span>{loading ? 'Generating Invoices...' : 'Generate Invoices'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
