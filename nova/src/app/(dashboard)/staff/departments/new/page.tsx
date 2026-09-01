import { requireAuth } from "@/lib/auth/require-auth";
import { StaffDAO } from "@/lib/dao/staff.dao";
import DepartmentForm from "@/components/staff/DepartmentForm";

export default async function NewDepartmentPage() {
  const tenantCtx = await requireAuth();
  
  const employees = await StaffDAO.list(tenantCtx);
  
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Department</h1>
        <p className="text-slate-500 mt-1">Create a new organizational department.</p>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <DepartmentForm employees={employees} />
      </div>
    </div>
  );
}
