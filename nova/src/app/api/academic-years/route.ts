import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const ctx = await requireAuth();

    const academicYears = await db.academicYear.findMany({
      where: { branchId: ctx.branchId },
      include: {
        terms: {
          orderBy: { startDate: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    const branchSettings = await db.branchSettings.findUnique({
      where: { branchId: ctx.branchId },
    });

    return NextResponse.json({
      academicYears,
      activeAcademicYearId: branchSettings?.activeAcademicYearId,
      activeTermId: branchSettings?.activeTermId,
    });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
