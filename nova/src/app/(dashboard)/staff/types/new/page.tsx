import { requireAuth } from "@/lib/auth/require-auth";
import EmployeeTypeForm from "@/components/staff/EmployeeTypeForm";

export default async function NewEmployeeTypePage() {
  await requireAuth();
  
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Employee Type</h1>
        <p className="text-slate-500 mt-1">Create a new staff role.</p>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <EmployeeTypeForm />
      </div>
    </div>
  );
}
