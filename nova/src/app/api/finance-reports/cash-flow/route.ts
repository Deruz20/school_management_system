import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { FinancialReportDAO } from "@/lib/dao/financial-report.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');
    const referenceDate = dateStr ? new Date(dateStr) : new Date();

    const data = await FinancialReportDAO.get12MonthCashFlow(ctx, referenceDate);
    return NextResponse.json(data);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
