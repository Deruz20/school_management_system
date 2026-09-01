import { requireAuth } from "@/lib/auth/require-auth";
import { DepartmentDAO } from "@/lib/dao/department.dao";
import { StaffDAO } from "@/lib/dao/staff.dao";
import DepartmentForm from "@/components/staff/DepartmentForm";
import { notFound } from "next/navigation";

export default async function EditDepartmentPage({ params }: { params: { id: string } }) {
  const tenantCtx = await requireAuth();
  const { id } = await params;
  
  const [department, employees] = await Promise.all([
    DepartmentDAO.getById(tenantCtx, id),
    StaffDAO.list(tenantCtx)
  ]);
  
  if (!department) {
    notFound();
  }
  
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Department</h1>
        <p className="text-slate-500 mt-1">Update department details.</p>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <DepartmentForm employees={employees} initialData={department} />
      </div>
    </div>
  );
}
