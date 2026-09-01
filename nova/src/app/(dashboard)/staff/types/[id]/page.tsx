import { requireAuth } from "@/lib/auth/require-auth";
import { EmployeeTypeDAO } from "@/lib/dao/employee-type.dao";
import EmployeeTypeForm from "@/components/staff/EmployeeTypeForm";
import { notFound } from "next/navigation";

export default async function EditEmployeeTypePage({ params }: { params: { id: string } }) {
  const tenantCtx = await requireAuth();
  const { id } = await params;
  
  const type = await EmployeeTypeDAO.getById(tenantCtx, id);
  
  if (!type) {
    notFound();
  }
  
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Employee Type</h1>
        <p className="text-slate-500 mt-1">Update employee type details.</p>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <EmployeeTypeForm initialData={type} />
      </div>
    </div>
  );
}
