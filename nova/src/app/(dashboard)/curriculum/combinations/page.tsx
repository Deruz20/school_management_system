import { requireAuth } from "@/lib/auth/require-auth";
import { SubjectDAO } from "@/lib/dao/subject.dao";
import CombinationsClient from "@/components/curriculum/CombinationsClient";

export default async function CombinationsPage() {
  const tenantCtx = await requireAuth();
  
  const [combinations, subjects] = await Promise.all([
    SubjectDAO.listCombinations(tenantCtx),
    SubjectDAO.listSubjects(tenantCtx) // active subjects
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subject Combinations</h1>
          <p className="text-slate-500 mt-1">Manage A-Level or specialized subject groupings.</p>
        </div>
      </div>
      <CombinationsClient initialCombinations={combinations} subjects={subjects} />
    </div>
  );
}
