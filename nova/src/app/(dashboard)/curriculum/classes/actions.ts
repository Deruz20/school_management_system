"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { ClassSubjectDAO } from "@/lib/dao/class-subject.dao";
import { revalidatePath } from "next/cache";

export async function assignClassSubjectAction(data: { classId: string; subjectId: string; academicYearId: string; teacherId?: string }) {
  try {
    const ctx = await requireAuth();
    await ClassSubjectDAO.assignSubject(ctx, data);
    revalidatePath("/curriculum/classes");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)) };
  }
}

export async function removeClassSubjectAction(id: string) {
  try {
    const ctx = await requireAuth();
    await ClassSubjectDAO.removeSubjectAssignment(ctx, id);
    revalidatePath("/curriculum/classes");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)) };
  }
}
