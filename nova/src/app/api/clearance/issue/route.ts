import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ClearanceDAO } from "@/lib/dao/clearance.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const clearance = await ClearanceDAO.issueClearancePermit(ctx, {
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      clearanceType: data.clearanceType,
      maxAllowedDebt: data.maxAllowedDebt,
      requiredPaidPercent: data.requiredPaidPercent,
      validUntil: data.validUntil
    });

    return NextResponse.json({ clearance }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
