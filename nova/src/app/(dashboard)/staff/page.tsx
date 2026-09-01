import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth/require-auth";
import { StaffDAO } from "@/lib/dao/staff.dao";
import Link from "next/link";

export default async function StaffPage() {
  const tenantCtx = await requireAuth();
  const staff = await StaffDAO.list(tenantCtx);
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff</h1>
          <p className="text-slate-500 mt-1">Manage employees, departments, and teaching assignments.</p>
        </div>
        <Link href="/staff/new">
          <Button className="gap-2">
            <Plus size={16} />
            <span>New Employee</span>
          </Button>
        </Link>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by name or code..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
             <Button variant="outline" size="sm">Filter</Button>
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  No employees found.
                </TableCell>
              </TableRow>
            )}
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-slate-900">{s.employeeCode}</TableCell>
                <TableCell>{s.firstName} {s.lastName}</TableCell>
                <TableCell>{s.department?.name || '-'}</TableCell>
                <TableCell>{s.employeeType.name}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 
                    s.status === 'TERMINATED' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {s.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/staff/${s.id}`}>
                    <Button variant="ghost" size="sm">View</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
