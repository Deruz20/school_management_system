import { requireAuth } from "@/lib/auth/require-auth";
import { FeeStructureDAO } from "@/lib/dao/fee-structure.dao";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Layers, ArrowLeft } from "lucide-react";

export default async function FeeStructuresPage() {
  const ctx = await requireAuth();
  const feeStructures = await FeeStructureDAO.list(ctx);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/finance" className="text-slate-400 hover:text-slate-600">
              <ArrowLeft size={16} />
            </Link>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Finance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fee Structures</h1>
          <p className="text-slate-500 mt-1">
            Manage composite class fee blueprints and fee schedules.
          </p>
        </div>
        <Link href="/finance/fee-structures/new">
          <Button className="gap-2">
            <Plus size={16} />
            <span>New Fee Structure</span>
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Structure Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Academic Period</TableHead>
              <TableHead>Items Breakdown</TableHead>
              <TableHead className="text-right">Mandatory Total</TableHead>
              <TableHead className="text-right">Grand Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feeStructures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Layers size={32} className="text-slate-300" />
                    <p className="font-medium text-slate-700">No fee structures configured yet</p>
                    <p className="text-xs text-slate-400">Click &quot;New Fee Structure&quot; to create your first class fee blueprint.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              feeStructures.map((fs) => {
                const grandTotal = fs.items.reduce((sum, item) => sum + Number(item.amount), 0);
                const mandatoryTotal = fs.items.reduce(
                  (sum, item) => (item.isOptional ? sum : sum + Number(item.amount)),
                  0
                );

                return (
                  <TableRow key={fs.id}>
                    <TableCell className="font-medium text-slate-900">
                      <div>{fs.name}</div>
                      {fs.description && (
                        <div className="text-xs text-slate-400 max-w-xs truncate">{fs.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-slate-700">
                      {fs.classRef?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium text-slate-800">
                        {fs.academicYear?.name || '-'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {fs.term?.name || 'All Terms / Annual'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {fs.items.map((item) => (
                          <span
                            key={item.id}
                            className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono"
                          >
                            {item.feeType.code}: {Number(item.amount).toLocaleString()}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-slate-800">
                      {mandatoryTotal.toLocaleString()} {fs.currency}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-blue-700">
                      {grandTotal.toLocaleString()} {fs.currency}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          fs.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {fs.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/finance/fee-structures/${fs.id}`}>
                        <Button variant="ghost" size="sm">
                          View / Edit
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
