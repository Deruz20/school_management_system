import { requireAuth } from "@/lib/auth/require-auth";
import { DepartmentDAO } from "@/lib/dao/department.dao";
import { EmployeeTypeDAO } from "@/lib/dao/employee-type.dao";
import StaffForm from "@/components/staff/StaffForm";

export default async function NewStaffPage() {
  const tenantCtx = await requireAuth();
  
  const [departments, employeeTypes] = await Promise.all([
    DepartmentDAO.list(tenantCtx),
    EmployeeTypeDAO.list(tenantCtx)
  ]);
  
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Employee</h1>
        <p className="text-slate-500 mt-1">Add a new staff member to the organization.</p>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <StaffForm departments={departments} employeeTypes={employeeTypes} />
      </div>
    </div>
  );
}
