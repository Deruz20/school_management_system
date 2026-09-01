import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { FinancialReportDAO } from "@/lib/dao/financial-report.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const academicYearId = searchParams.get('academicYearId') || undefined;
    const termId = searchParams.get('termId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const summary = await FinancialReportDAO.getExecutiveSummary(ctx, {
      academicYearId,
      termId,
      startDate,
      endDate
    });

    return NextResponse.json(summary);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
