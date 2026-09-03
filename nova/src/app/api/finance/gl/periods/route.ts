import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { FiscalPeriodDAO } from "@/lib/dao/gl.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const fiscalYearId = searchParams.get("fiscalYearId") || undefined;

    const [fiscalYears, periods] = await Promise.all([
      FiscalPeriodDAO.listFiscalYears(ctx),
      FiscalPeriodDAO.listPeriods(ctx, fiscalYearId)
    ]);

    return NextResponse.json({ fiscalYears, periods });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    if (data.action === "INIT_YEAR") {
      const year = parseInt(data.year, 10);
      const fy = await FiscalPeriodDAO.initFiscalYear(ctx, year);
      return NextResponse.json({ fiscalYear: fy }, { status: 201 });
    }

    if (data.action === "CLOSE_PERIOD") {
      const updated = await FiscalPeriodDAO.closePeriod(ctx, data.periodId);
      return NextResponse.json({ period: updated }, { status: 200 });
    }

    if (data.action === "LOCK_PERIOD") {
      const updated = await FiscalPeriodDAO.lockPeriod(ctx, data.periodId);
      return NextResponse.json({ period: updated }, { status: 200 });
    }

    if (data.action === "REOPEN_PERIOD") {
      const updated = await FiscalPeriodDAO.reopenPeriod(ctx, data.periodId, data.reason);
      return NextResponse.json({ period: updated }, { status: 200 });
    }

    return new NextResponse("Invalid action", { status: 400 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
