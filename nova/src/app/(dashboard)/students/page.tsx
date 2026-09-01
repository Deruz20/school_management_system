import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth/require-auth";
import { StudentDAO } from "@/lib/dao/student.dao";
import Link from "next/link";

export default async function StudentsPage() {
  const tenantCtx = await requireAuth();
  const { students } = await StudentDAO.getStudents(tenantCtx);
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Students</h1>
          <p className="text-slate-500 mt-1">Manage student records, enrollments, and profiles.</p>
        </div>
        <Link href="/students/new">
          <Button className="gap-2">
            <Plus size={16} />
            <span>New Student</span>
          </Button>
        </Link>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by name or admission no..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
             <Button variant="outline" size="sm">Filter</Button>
             <Button variant="outline" size="sm">Export</Button>
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Stream</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  No students found.
                </TableCell>
              </TableRow>
            )}
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-slate-900">{s.admissionNo}</TableCell>
                <TableCell>{s.firstName} {s.lastName}</TableCell>
                <TableCell>{s.classRef?.name || 'Unassigned'}</TableCell>
                <TableCell>{s.streamRef?.name || '-'}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {s.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/students/${s.id}/subjects`}>
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
