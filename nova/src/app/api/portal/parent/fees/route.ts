import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ParentPortalDAO } from "@/lib/dao/parent-portal.dao";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("studentId query parameter is required.", { status: 400 });
    }

    let guardianId = url.searchParams.get("guardianId");
    if (!guardianId) {
      const user = await db.user.findUnique({
        where: { id: ctx.userId },
        select: { guardianId: true }
      });
      guardianId = user?.guardianId || null;
    }

    if (!guardianId) {
      return new NextResponse("Authenticated user is not linked to a guardian profile.", { status: 403 });
    }

    const statement = await ParentPortalDAO.getChildFeeStatement(guardianId, studentId);
    return NextResponse.json(statement);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
