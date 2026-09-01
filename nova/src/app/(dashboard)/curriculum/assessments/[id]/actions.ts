"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { MarkDAO } from "@/lib/dao/mark.dao";
import { MarkStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function upsertMarkAction(data: {
  studentId: string;
  assessmentId: string;
  score?: number | null;
  status: MarkStatus;
}) {
  try {
    const ctx = await requireAuth();
    await MarkDAO.upsertMark(ctx, data);
    revalidatePath(`/curriculum/assessments/${data.assessmentId}`);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? error.message : String(error)) };
  }
}
