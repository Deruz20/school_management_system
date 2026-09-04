import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { StudentPortalDAO } from "@/lib/dao/student-portal.dao";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);

    let studentId = url.searchParams.get("studentId");
    if (!studentId) {
      const user = await db.user.findUnique({
        where: { id: ctx.userId },
        select: { studentId: true }
      });
      studentId = user?.studentId || null;
    }

    if (!studentId) {
      return new NextResponse("Authenticated user is not linked to a student record.", { status: 403 });
    }

    const dashboard = await StudentPortalDAO.getStudentDashboard(studentId);
    return NextResponse.json(dashboard);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
