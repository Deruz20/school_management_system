import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { RequirementsDAO } from "@/lib/dao/requirements.dao";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const academicYearId = searchParams.get("academicYearId");
    if (!academicYearId) {
      return new NextResponse("academicYearId is required", { status: 400 });
    }
    const termId = searchParams.get("termId") || undefined;

    const record = await RequirementsDAO.getStudentRequirementRecord(ctx, {
      studentId: params.id,
      academicYearId,
      termId
    });

    if (!record) {
      return new NextResponse("Student Requirement Record not found", { status: 404 });
    }

    return NextResponse.json({ record });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
