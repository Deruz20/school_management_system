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
import { ArrowLeft, Ban, AlertTriangle, Printer } from 'lucide-react';
import Link from 'next/link';
import { InvoiceStatus } from '@prisma/client';

export default function InvoiceDetailClient({
  invoice
}: {
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: Date | string;
    dueDate: Date | string;
    grossAmount: number | string | { toString(): string };
    discountAmount: number | string | { toString(): string };
    netAmount: number | string | { toString(): string };
    status: InvoiceStatus;
    notes: string | null;
    voidReason: string | null;
    voidedAt: Date | string | null;
    student: { id: string; firstName: string; lastName: string; admissionNo: string };
    enrollment: { classRef: { name: string } } | null;
    academicYear: { name: string };
    term: { name: string } | null;
    feeStructure: { name: string } | null;
    items: {
      id: string;
      feeTypeName: string;
      description: string | null;
      unitAmount: number | string | { toString(): string };
      quantity: number;
      discount: number | string | { toString(): string };
      lineTotal: number | string | { toString(): string };
      feeType: { name: string; code: string } | null;
    }[];
  };
}) {
  const router = useRouter();
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!voidReason.trim()) {
        throw new Error('Please provide an explicit reason for voiding this invoice.');
      }

      const res = await fetch(`/api/invoices/${invoice.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to void invoice.');
      }

      setVoidModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (st: InvoiceStatus) => {
    switch (st) {
      case InvoiceStatus.PENDING:
        return (
          <span className="inline-flex items-center text-xs px-3 py-1 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-300">
            PENDING PAYMENT
          </span>
        );
      case InvoiceStatus.PARTIAL:
        return (
          <span className="inline-flex items-center text-xs px-3 py-1 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-300">
            PARTIAL
          </span>
        );
      case InvoiceStatus.PAID:
        return (
          <span className="inline-flex items-center text-xs px-3 py-1 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
            PAID IN FULL
          </span>
        );
      case InvoiceStatus.OVERDUE:
        return (
          <span className="inline-flex items-center text-xs px-3 py-1 rounded-full font-bold bg-red-50 text-red-700 border border-red-300">
            OVERDUE
          </span>
        );
      case InvoiceStatus.VOID:
        return (
          <span className="inline-flex items-center text-xs px-3 py-1 rounded-full font-bold bg-slate-100 text-slate-500 border border-slate-300 line-through">
            VOIDED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/finance/invoices">
            <Button variant="outline" size="sm" className="h-9 w-9 p-0">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Invoice #{invoice.invoiceNumber}
            </h1>
            <p className="text-slate-500 text-xs">
              Issued on {new Date(invoice.issueDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5"
          >
            <Printer size={15} />
            <span>Print</span>
          </Button>
          {invoice.status !== InvoiceStatus.VOID && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVoidReason('');
                setError('');
                setVoidModalOpen(true);
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 inline-flex items-center gap-1.5"
            >
              <Ban size={15} />
              <span>Void Invoice</span>
            </Button>
          )}
        </div>
      </div>

      {invoice.status === InvoiceStatus.VOID && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 space-y-1">
          <div className="flex items-center gap-2 font-bold text-sm text-red-900">
            <AlertTriangle size={18} />
            <span>This invoice has been VOIDED and is no longer payable.</span>
          </div>
          <p className="text-xs text-red-700">
            <strong>Void Reason:</strong> {invoice.voidReason || 'Not specified'}
          </p>
          {invoice.voidedAt && (
            <p className="text-xs text-red-500">
              Voided on {new Date(invoice.voidedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Official Invoice Sheet */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Official Invoice
            </span>
            <h2 className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
              {invoice.invoiceNumber}
            </h2>
            {invoice.feeStructure && (
              <p className="text-xs text-slate-500 mt-1">
                Blueprint: <span className="font-semibold">{invoice.feeStructure.name}</span>
              </p>
            )}
          </div>
          <div>{getStatusBadge(invoice.status)}</div>
        </div>

        {/* Student & Period Meta */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Billed To</span>
            <p className="font-bold text-slate-900 mt-0.5">
              {invoice.student.firstName} {invoice.student.lastName}
            </p>
            <p className="text-xs text-slate-500 font-mono">{invoice.student.admissionNo}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Academic Context</span>
            <p className="font-semibold text-slate-800 mt-0.5">
              Class: {invoice.enrollment?.classRef?.name || '-'}
            </p>
            <p className="text-xs text-slate-500">
              {invoice.academicYear.name} • {invoice.term?.name || 'Annual'}
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Payment Terms</span>
            <p className="text-xs text-slate-700 mt-0.5">
              <strong>Issued:</strong> {new Date(invoice.issueDate).toLocaleDateString()}
            </p>
            <p className="text-xs text-slate-700 font-medium">
              <strong>Due Date:</strong> {new Date(invoice.dueDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Head / Description</TableHead>
                <TableHead className="text-center w-20">Qty</TableHead>
                <TableHead className="text-right">Unit Amount</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-slate-900">
                    <div>{item.feeTypeName}</div>
                    {item.description && (
                      <div className="text-xs text-slate-400">{item.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">{item.quantity}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-slate-700">
                    UGX {Number(item.unitAmount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-emerald-700">
                    {Number(item.discount) > 0
                      ? `- UGX ${Number(item.discount).toLocaleString()}`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-slate-900">
                    UGX {Number(item.lineTotal).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Totals Summary */}
        <div className="flex justify-end">
          <div className="w-full sm:w-80 space-y-2 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex justify-between text-slate-600">
              <span>Gross Amount:</span>
              <span className="font-mono">UGX {Number(invoice.grossAmount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Total Discounts / Bursaries:</span>
              <span className="font-mono">
                - UGX {Number(invoice.discountAmount).toLocaleString()}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-base text-slate-900">
              <span>Total Net Payable:</span>
              <span className="font-mono text-blue-700">
                UGX {Number(invoice.netAmount).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="border-t border-slate-100 pt-4 text-xs text-slate-500">
            <strong>Notes:</strong> {invoice.notes}
          </div>
        )}
      </div>

      {/* Void Modal */}
      {voidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600 font-bold">
              <Ban size={20} />
              <span>Confirm Invoice Void</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Voiding an invoice marks it as invalid and non-payable while preserving the audit
              record. This action cannot be reversed.
            </p>

            {error && (
              <div className="p-3 text-xs rounded bg-red-50 text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleVoid} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Voiding <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g. Student billed for wrong term / duplicate entry"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVoidModalOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {loading ? 'Voiding...' : 'Confirm Void'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
