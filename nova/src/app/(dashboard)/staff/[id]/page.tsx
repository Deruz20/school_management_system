import { requireAuth } from "@/lib/auth/require-auth";
import { StaffDAO } from "@/lib/dao/staff.dao";
import { DepartmentDAO } from "@/lib/dao/department.dao";
import { EmployeeTypeDAO } from "@/lib/dao/employee-type.dao";
import StaffForm from "@/components/staff/StaffForm";
import { notFound } from "next/navigation";

export default async function EditStaffPage({ params }: { params: { id: string } }) {
  const tenantCtx = await requireAuth();
  const { id } = await params;
  
  const [employee, departments, employeeTypes] = await Promise.all([
    StaffDAO.getById(tenantCtx, id),
    DepartmentDAO.list(tenantCtx),
    EmployeeTypeDAO.list(tenantCtx)
  ]);
  
  if (!employee) {
    notFound();
  }
  
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Employee</h1>
        <p className="text-slate-500 mt-1">Update employee details or access levels.</p>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <StaffForm 
          departments={departments} 
          employeeTypes={employeeTypes} 
          initialData={employee} 
        />
      </div>
    </div>
  );
}
