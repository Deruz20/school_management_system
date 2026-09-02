import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ClearanceDAO } from "@/lib/dao/clearance.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await ClearanceDAO.evaluateStudentClearance(ctx, {
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      maxAllowedDebt: data.maxAllowedDebt,
      requiredPaidPercent: data.requiredPaidPercent
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
