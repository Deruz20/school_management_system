import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { LedgerDAO } from "@/lib/dao/ledger.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const entry = await LedgerDAO.postOpeningBalance(ctx, {
      studentId: data.studentId,
      academicYearId: data.academicYearId || null,
      termId: data.termId || null,
      direction: data.direction,
      amount: data.amount,
      reason: data.reason,
      cutoffDate: data.cutoffDate || undefined
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
