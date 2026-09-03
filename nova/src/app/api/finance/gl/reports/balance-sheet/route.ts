import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { FinancialStatementsDAO } from "@/lib/dao/financial-statements.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const asOfDate = searchParams.get("asOfDate") || undefined;

    const report = await FinancialStatementsDAO.getBalanceSheet(ctx, asOfDate);
    return NextResponse.json({ report });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
