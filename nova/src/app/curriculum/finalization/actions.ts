'use server';

import { FinalizationDAO } from '@/lib/dao/finalization.dao';
import { revalidatePath } from 'next/cache';
import { db as prisma } from '@/lib/db';

export async function fetchClassEnrollments(classId: string, termId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: 'ACTIVE' },
    include: {
      student: true,
      termResults: {
        where: { termId, status: 'FINALIZED' }
      }
    }
  });

  return enrollments.map(enr => ({
    id: enr.id,
    studentName: `${enr.student.firstName} ${enr.student.lastName}`,
    admissionNo: enr.student.admissionNo,
    finalized: enr.termResults.length > 0,
    termResultId: enr.termResults.length > 0 ? enr.termResults[0].id : undefined
  }));
}

export async function previewFinalizationAction(enrollmentId: string, termId: string) {
  try {
    // For Pilot: Fetch first branch as tenant context
    const branch = await prisma.branch.findFirstOrThrow();

    const preview = await FinalizationDAO.previewFinalization(enrollmentId, termId, branch.id);
    return { success: true, data: preview };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)) };
  }
}

export async function finalizeResultAction(enrollmentId: string, termId: string, correctionReason?: string) {
  try {
    const branch = await prisma.branch.findFirstOrThrow();
    // For Pilot: Fetch first STAFF user as actor
    const user = await prisma.user.findFirst({ where: { userType: 'STAFF' } });
    if (!user) throw new Error('No staff user found to act as authorizer');

    const result = await FinalizationDAO.finalizeTermResult(enrollmentId, termId, branch.id, user.id, correctionReason);
    
    revalidatePath('/curriculum/finalization');
    return { success: true, data: result };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)) };
  }
}
