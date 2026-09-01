import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { FinancialReportDAO } from "@/lib/dao/financial-report.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const classId = searchParams.get('classId') || undefined;
    const minBalance = searchParams.get('minBalance') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;

    const data = await FinancialReportDAO.getDebtorsReport(ctx, {
      classId,
      minBalance,
      search,
      page,
      limit
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
