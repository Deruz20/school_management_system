import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { StudentPortalDAO } from "@/lib/dao/student-portal.dao";
import { db } from "@/lib/db";
import { ExeatType } from "@prisma/client";

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

    const exeats = await StudentPortalDAO.getExeatHistory(studentId);
    return NextResponse.json({ exeats });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    let studentId = body.studentId;
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

    const exeat = await StudentPortalDAO.requestExeat(studentId, {
      exeatType: body.exeatType as ExeatType,
      reason: body.reason,
      intendedDeparture: body.intendedDeparture,
      expectedReturn: body.expectedReturn,
      accompanyingAdult: body.accompanyingAdult,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined
    });

    return NextResponse.json({ exeat });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
