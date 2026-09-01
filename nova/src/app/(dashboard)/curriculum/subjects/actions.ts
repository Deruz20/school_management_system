"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { SubjectDAO } from "@/lib/dao/subject.dao";
import { revalidatePath } from "next/cache";

export async function createSubjectAction(data: { name: string; code: string; description?: string }) {
  try {
    const ctx = await requireAuth();
    await SubjectDAO.createSubject(ctx, data);
    revalidatePath("/curriculum/subjects");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)) };
  }
}

export async function updateSubjectAction(id: string, data: { name?: string; code?: string; description?: string; isActive?: boolean }) {
  try {
    const ctx = await requireAuth();
    await SubjectDAO.updateSubject(ctx, id, data);
    revalidatePath("/curriculum/subjects");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)) };
  }
}
