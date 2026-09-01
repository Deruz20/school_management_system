import { requireAuth } from "@/lib/auth/require-auth";
import { DepartmentDAO } from "@/lib/dao/department.dao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DepartmentsPage() {
  const tenantCtx = await requireAuth();
  const departments = await DepartmentDAO.list(tenantCtx);
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Departments</h1>
          <p className="text-slate-500 mt-1">Manage staff departments.</p>
        </div>
        <Link href="/staff/departments/new">
          <Button>New Department</Button>
        </Link>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department Name</TableHead>
              <TableHead>HOD</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>{d.hodId || '-'}</TableCell>
                <TableCell>{d._count?.employees || 0}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/staff/departments/${d.id}`}>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {departments.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">No departments found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
