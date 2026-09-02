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

    const classId = searchParams.get("classId") || undefined;
    const termId = searchParams.get("termId") || undefined;
    const isFullyCompliant = searchParams.has("isFullyCompliant")
      ? searchParams.get("isFullyCompliant") === "true"
      : undefined;
    const search = searchParams.get("search") || undefined;
    const page = searchParams.has("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const limit = searchParams.has("limit") ? parseInt(searchParams.get("limit")!, 10) : 25;

    const result = await RequirementsDAO.listStudentRequirementRecords(ctx, {
      academicYearId,
      classId,
      termId,
      isFullyCompliant,
      search,
      page,
      limit
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
