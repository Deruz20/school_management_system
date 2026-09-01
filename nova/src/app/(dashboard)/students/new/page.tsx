import { requireAuth } from "@/lib/auth/require-auth";
import NewStudentForm from "@/components/students/NewStudentForm";

export default async function NewStudentPage() {
  // Enforce auth before rendering
  await requireAuth();
  
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add New Student</h1>
        <p className="text-slate-500 mt-1">Enroll a new student into the branch.</p>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <NewStudentForm />
      </div>
    </div>
  );
}
