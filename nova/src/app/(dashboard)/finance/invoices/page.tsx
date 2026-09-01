import { requireAuth } from "@/lib/auth/require-auth";
import { InvoiceDAO } from "@/lib/dao/invoice.dao";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { FileText, Plus, Layers, Eye } from "lucide-react";
import { InvoiceStatus } from "@prisma/client";

export default async function InvoicesPage({
  searchParams
}: {
  searchParams: Promise<{ classId?: string; status?: InvoiceStatus }>;
}) {
  const ctx = await requireAuth();
  const { classId, status } = await searchParams;

  const invoices = await InvoiceDAO.list(ctx, { classId, status });

  const getStatusBadge = (st: InvoiceStatus) => {
    switch (st) {
      case InvoiceStatus.PENDING:
        return (
          <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-800 border border-amber-200">
            Pending
          </span>
        );
      case InvoiceStatus.PARTIAL:
        return (
          <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Partial
          </span>
        );
      case InvoiceStatus.PAID:
        return (
          <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Paid
          </span>
        );
      case InvoiceStatus.OVERDUE:
        return (
          <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">
            Overdue
          </span>
        );
      case InvoiceStatus.VOID:
        return (
          <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500 border border-slate-200 line-through">
            Void
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Invoices</h1>
          <p className="text-slate-500 text-sm mt-1">
            Issued billing records, bulk generation batches, and individual student fee statements.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/finance/invoices/bulk">
            <Button variant="outline" className="inline-flex items-center gap-2">
              <Layers size={16} />
              <span>Bulk Class Billing</span>
            </Button>
          </Link>
          <Link href="/finance/invoices/new">
            <Button className="inline-flex items-center gap-2">
              <Plus size={16} />
              <span>New Individual Invoice</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Invoices Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Number</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Class &amp; Period</TableHead>
              <TableHead>Issue / Due Date</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Net Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <FileText size={32} className="text-slate-300" />
                    <p className="font-medium text-slate-700">No invoices found</p>
                    <p className="text-xs text-slate-400">
                      Generate class invoices or create an individual billing record to get started.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono font-semibold text-blue-700">
                    {inv.invoiceNumber}
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">
                    <div>
                      {inv.student.firstName} {inv.student.lastName}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {inv.student.admissionNo}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-semibold text-slate-800">
                      {inv.enrollment?.classRef?.name || '-'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {inv.academicYear.name} {inv.term ? `• ${inv.term.name}` : ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-700">
                      {new Date(inv.issueDate).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-slate-400">
                      Due: {new Date(inv.dueDate).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-slate-600">
                    UGX {Number(inv.grossAmount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-emerald-700">
                    {Number(inv.discountAmount) > 0
                      ? `- UGX ${Number(inv.discountAmount).toLocaleString()}`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">
                    UGX {Number(inv.netAmount).toLocaleString()}
                  </TableCell>
                  <TableCell>{getStatusBadge(inv.status)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/finance/invoices/${inv.id}`}>
                      <Button size="sm" variant="outline" className="h-8 px-2 text-xs">
                        <Eye size={14} className="mr-1" />
                        <span>View</span>
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
