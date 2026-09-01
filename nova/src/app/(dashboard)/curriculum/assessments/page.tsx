import { requireAuth } from "@/lib/auth/require-auth";
import { db } from "@/lib/db";
import AssessmentsClient from "@/components/curriculum/AssessmentsClient";
import { AssessmentDAO } from "@/lib/dao/assessment.dao";
import { ClassSubjectDAO } from "@/lib/dao/class-subject.dao";
import { SettingsDAO } from "@/lib/dao/settings.dao";

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; termId?: string; classSubjectId?: string }>;
}) {
  const tenantCtx = await requireAuth();
  const params = await searchParams;

  // Load context data
  const [classes, activeContext] = await Promise.all([
    db.class.findMany({ where: { branchId: tenantCtx.branchId }, orderBy: { name: 'asc' } }),
    SettingsDAO.getActiveContext(tenantCtx.branchId)
  ]);

  const activeYear = activeContext.academicYear;
  let terms: import('@prisma/client').Term[] = [];
  if (activeYear) {
    terms = await db.term.findMany({ where: { academicYearId: activeYear.id }, orderBy: { startDate: 'asc' } });
  }

  const termId = params.termId || activeContext.term?.id || (terms.length ? terms[0].id : undefined);
  const classId = params.classId || (classes.length > 0 ? classes[0].id : undefined);
  const classSubjectId = params.classSubjectId;

  let classSubjects: Awaited<ReturnType<typeof ClassSubjectDAO.listClassSubjects>> = [];
  if (classId && activeYear) {
    classSubjects = await ClassSubjectDAO.listClassSubjects(tenantCtx, classId, activeYear.id);
  }

  let assessments: Awaited<ReturnType<typeof AssessmentDAO.listAssessments>> = [];
  if (classSubjectId && termId) {
    assessments = await AssessmentDAO.listAssessments(tenantCtx, classSubjectId, termId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assessments</h1>
          <p className="text-slate-500 mt-1">Manage assessments and exams.</p>
        </div>
      </div>
      
      {!activeYear ? (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded">No active academic year found.</div>
      ) : (
        <AssessmentsClient 
          classes={classes}
          terms={terms}
          classSubjects={classSubjects}
          assessments={assessments}
          initialClassId={classId}
          initialTermId={termId}
          initialClassSubjectId={classSubjectId}
        />
      )}
    </div>
  );
}
