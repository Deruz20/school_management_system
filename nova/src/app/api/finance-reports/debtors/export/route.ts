import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { FinancialReportDAO } from "@/lib/dao/financial-report.dao";
import { AuditService } from "@/lib/services/audit.service";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const classId = searchParams.get('classId') || undefined;
    const minBalance = searchParams.get('minBalance') || undefined;
    const search = searchParams.get('search') || undefined;

    const csvContent = await FinancialReportDAO.exportDebtorsCsv(ctx, {
      classId,
      minBalance,
      search
    });

    await AuditService.log(
      ctx,
      'EXPORT_DEBTORS_REPORT',
      'FinancialReport',
      ctx.branchId,
      JSON.stringify({ classId, minBalance, search })
    );

    const filename = `debtors_report_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
