import { requireAuth } from "@/lib/auth/require-auth";
import { EmployeeTypeDAO } from "@/lib/dao/employee-type.dao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function EmployeeTypesPage() {
  const tenantCtx = await requireAuth();
  const types = await EmployeeTypeDAO.list(tenantCtx);
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Employee Types</h1>
          <p className="text-slate-500 mt-1">Manage staff roles and teaching eligibility.</p>
        </div>
        <Link href="/staff/types/new">
          <Button>New Type</Button>
        </Link>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Teaching Staff?</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.description || '-'}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    t.isTeachingStaff ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {t.isTeachingStaff ? 'Yes' : 'No'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/staff/types/${t.id}`}>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {types.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">No types found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
