import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ClearanceDAO } from "@/lib/dao/clearance.dao";
import { ClearanceStatus, ClearanceType, ClearanceDocStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const academicYearId = searchParams.get("academicYearId") || undefined;
    const termId = searchParams.get("termId") || undefined;
    const classId = searchParams.get("classId") || undefined;
    const studentId = searchParams.get("studentId") || undefined;
    const clearanceType = (searchParams.get("clearanceType") as ClearanceType) || undefined;
    const status = (searchParams.get("status") as ClearanceStatus) || undefined;
    const docStatus = (searchParams.get("docStatus") as ClearanceDocStatus) || undefined;
    const search = searchParams.get("search") || undefined;
    const page = searchParams.has("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const limit = searchParams.has("limit") ? parseInt(searchParams.get("limit")!, 10) : 25;

    const result = await ClearanceDAO.listClearances(ctx, {
      academicYearId,
      termId,
      classId,
      studentId,
      clearanceType,
      status,
      docStatus,
      search,
      page,
      limit
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
