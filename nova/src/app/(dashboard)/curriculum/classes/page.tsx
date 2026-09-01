import { requireAuth } from "@/lib/auth/require-auth";
import { db } from "@/lib/db";
import ClassSubjectsClient from "@/components/curriculum/ClassSubjectsClient";
import { SubjectDAO } from "@/lib/dao/subject.dao";
import { ClassSubjectDAO } from "@/lib/dao/class-subject.dao";
import { SettingsDAO } from "@/lib/dao/settings.dao";

export default async function ClassSubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; academicYearId?: string }>;
}) {
  const tenantCtx = await requireAuth();
  const params = await searchParams;

  // Load context data
  const [classes, activeContext, subjects, teachers] = await Promise.all([
    db.class.findMany({ where: { branchId: tenantCtx.branchId }, orderBy: { name: 'asc' } }),
    SettingsDAO.getActiveContext(tenantCtx.branchId),
    SubjectDAO.listSubjects(tenantCtx),
    db.employee.findMany({ 
      where: { branchId: tenantCtx.branchId, status: 'ACTIVE', employeeType: { isTeachingStaff: true } }, 
      orderBy: { lastName: 'asc' },
      include: { user: true }
    })
  ]);
  const activeYear = activeContext.academicYear;

  const academicYearId = params.academicYearId || activeYear?.id;
  const classId = params.classId || (classes.length > 0 ? classes[0].id : undefined);

  let classSubjects: Awaited<ReturnType<typeof ClassSubjectDAO.listClassSubjects>> = [];
  if (classId && academicYearId) {
    classSubjects = await ClassSubjectDAO.listClassSubjects(tenantCtx, classId, academicYearId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Class Subjects</h1>
          <p className="text-slate-500 mt-1">Assign subjects and teachers to classes.</p>
        </div>
      </div>
      
      {!activeYear ? (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded">No active academic year found.</div>
      ) : (
        <ClassSubjectsClient 
          classes={classes}
          subjects={subjects}
          initialClassSubjects={classSubjects}
          initialClassId={classId}
          academicYearId={academicYearId as string}
          teachers={teachers}
        />)}
    </div>
  );
}
