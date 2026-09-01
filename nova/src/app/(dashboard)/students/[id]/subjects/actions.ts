"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { EnrollmentSubjectDAO } from "@/lib/dao/enrollment-subject.dao";
import { revalidatePath } from "next/cache";

export async function assignIndividualSubjectsAction(studentId: string, enrollmentId: string, subjectIds: string[], isElective: boolean = false) {
  try {
    const ctx = await requireAuth();
    await EnrollmentSubjectDAO.assignSubjects(ctx, enrollmentId, subjectIds, isElective);
    revalidatePath(`/students/${studentId}/subjects`);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? error.message : String(error)) };
  }
}

export async function assignCombinationAction(studentId: string, enrollmentId: string, combinationId: string) {
  try {
    const ctx = await requireAuth();
    await EnrollmentSubjectDAO.assignCombination(ctx, enrollmentId, combinationId);
    revalidatePath(`/students/${studentId}/subjects`);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? error.message : String(error)) };
  }
}

export async function removeEnrollmentSubjectAction(studentId: string, enrollmentId: string, subjectId: string) {
  try {
    const ctx = await requireAuth();
    await EnrollmentSubjectDAO.removeSubject(ctx, enrollmentId, subjectId);
    revalidatePath(`/students/${studentId}/subjects`);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? error.message : String(error)) };
  }
}
