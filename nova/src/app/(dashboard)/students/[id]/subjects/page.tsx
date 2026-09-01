import { requireAuth } from "@/lib/auth/require-auth";
import { db } from "@/lib/db";
import { EnrollmentSubjectDAO } from "@/lib/dao/enrollment-subject.dao";
import { SubjectDAO } from "@/lib/dao/subject.dao";
import StudentSubjectsClient from "@/components/curriculum/StudentSubjectsClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function StudentSubjectsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enrollmentId?: string }>;
}) {
  const tenantCtx = await requireAuth();
  const { id } = await params;
  const sParams = await searchParams;

  const student = await db.student.findUnique({
    where: { id },
    include: {
      enrollments: {
        include: { academicYear: true, classRef: true },
        orderBy: { academicYear: { startDate: 'desc' } }
      }
    }
  });

  if (!student || student.branchId !== tenantCtx.branchId) {
    return <div>Student not found</div>;
  }

  const enrollmentId = sParams.enrollmentId || (student.enrollments.length > 0 ? student.enrollments[0].id : undefined);

  let enrollmentSubjects: Awaited<ReturnType<typeof EnrollmentSubjectDAO.getEnrollmentSubjects>> = [];
  if (enrollmentId) {
    enrollmentSubjects = await EnrollmentSubjectDAO.getEnrollmentSubjects(tenantCtx, enrollmentId);
  }

  const [subjects, combinations] = await Promise.all([
    SubjectDAO.listSubjects(tenantCtx),
    SubjectDAO.listCombinations(tenantCtx)
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/students" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft size={16} className="mr-1" /> Back to Students
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{student.firstName} {student.lastName}</h1>
        <p className="text-slate-500 mt-1">Manage enrolled subjects and combinations.</p>
      </div>
      
      {student.enrollments.length === 0 ? (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded">This student has no active enrollments.</div>
      ) : (
        <StudentSubjectsClient 
          studentId={id}
          enrollments={student.enrollments}
          initialEnrollmentId={enrollmentId}
          initialEnrollmentSubjects={enrollmentSubjects}
          subjects={subjects}
          combinations={combinations}
        />
      )}
    </div>
  );
}
