import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { LedgerDAO } from "@/lib/dao/ledger.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    const mode = url.searchParams.get("mode") || "statement"; // "balance" or "statement"
    const academicYearId = url.searchParams.get("academicYearId") || undefined;
    const termId = url.searchParams.get("termId") || undefined;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;

    if (!studentId) {
      return new NextResponse("studentId is required", { status: 400 });
    }

    if (mode === "balance") {
      const balance = await LedgerDAO.getBalance(ctx, studentId);
      return NextResponse.json(balance);
    }

    const statement = await LedgerDAO.getStatement(ctx, studentId, {
      academicYearId,
      termId,
      startDate,
      endDate
    });

    return NextResponse.json(statement);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
