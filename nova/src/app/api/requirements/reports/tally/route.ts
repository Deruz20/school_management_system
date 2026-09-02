import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { RequirementsDAO } from "@/lib/dao/requirements.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const academicYearId = searchParams.get("academicYearId");
    if (!academicYearId) {
      return new NextResponse("academicYearId is required", { status: 400 });
    }

    const termId = searchParams.get("termId") || undefined;
    const classId = searchParams.get("classId") || undefined;

    const tally = await RequirementsDAO.getStorekeeperTally(ctx, {
      academicYearId,
      termId,
      classId
    });

    return NextResponse.json(tally);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
