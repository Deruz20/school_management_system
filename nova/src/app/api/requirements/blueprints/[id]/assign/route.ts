import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { RequirementsDAO } from "@/lib/dao/requirements.dao";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await RequirementsDAO.bulkAssignRequirements(ctx, {
      classRequirementId: params.id,
      academicYearId: data.academicYearId,
      termId: data.termId,
      studentIds: data.studentIds
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
