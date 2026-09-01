"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { AssessmentDAO } from "@/lib/dao/assessment.dao";
import { revalidatePath } from "next/cache";

export async function createAssessmentAction(data: { classSubjectId: string; termId: string; name: string; maxScore: number; weight: number }) {
  try {
    const ctx = await requireAuth();
    await AssessmentDAO.createAssessment(ctx, data);
    revalidatePath("/curriculum/assessments");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)) };
  }
}
