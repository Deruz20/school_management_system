"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { SubjectDAO } from "@/lib/dao/subject.dao";
import { revalidatePath } from "next/cache";

export async function createCombinationAction(name: string, subjectIds: { subjectId: string, isCore: boolean }[]) {
  try {
    const ctx = await requireAuth();
    await SubjectDAO.createCombination(ctx, name, subjectIds);
    revalidatePath("/curriculum/combinations");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)) };
  }
}

export async function deleteCombinationAction(id: string) {
  try {
    const ctx = await requireAuth();
    await SubjectDAO.deleteCombination(ctx, id);
    revalidatePath("/curriculum/combinations");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)) };
  }
}
