import { requireAuth } from "@/lib/auth/require-auth";
import { SubjectDAO } from "@/lib/dao/subject.dao";
import SubjectsClient from "@/components/curriculum/SubjectsClient";

export default async function SubjectsPage() {
  const tenantCtx = await requireAuth();
  const subjects = await SubjectDAO.listSubjects(tenantCtx, true);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subjects</h1>
          <p className="text-slate-500 mt-1">Manage subjects for your institution.</p>
        </div>
      </div>
      <SubjectsClient initialSubjects={subjects} />
    </div>
  );
}
