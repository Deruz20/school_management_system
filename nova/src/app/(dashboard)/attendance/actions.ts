"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { AttendanceDAO } from "@/lib/dao/attendance.dao";
import { AttendanceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function saveAttendanceAction(
  classId: string, 
  dateStr: string, 
  records: { studentId: string; status: AttendanceStatus }[]
) {
  try {
    const tenantCtx = await requireAuth();
    const date = new Date(dateStr);
    
    await AttendanceDAO.saveAttendance(tenantCtx, classId, date, records);
    
    revalidatePath("/attendance");
    return { success: true };
  } catch (error) {
    return { error: (error as Error).message || "Failed to save attendance" };
  }
}
