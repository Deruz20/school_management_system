import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { FinancialStatementsDAO } from "@/lib/dao/financial-statements.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const startDate = searchParams.get("startDate") || startOfYear.toISOString();
    const endDate = searchParams.get("endDate") || now.toISOString();

    const report = await FinancialStatementsDAO.getIncomeStatement(ctx, startDate, endDate);
    return NextResponse.json({ report });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
