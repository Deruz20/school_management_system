import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const reportType = searchParams.get("type") || "valuation";
    const storeId = searchParams.get("storeId") || undefined;
    const departmentId = searchParams.get("departmentId") || undefined;
    const academicYearId = searchParams.get("academicYearId") || undefined;
    const termId = searchParams.get("termId") || undefined;
    const itemId = searchParams.get("itemId") || undefined;
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined;

    if (reportType === "valuation") {
      const report = await InventoryDAO.getStockValuationReport(ctx, { storeId });
      return NextResponse.json(report);
    } else if (reportType === "low-stock") {
      const items = await InventoryDAO.getLowStockReport(ctx);
      return NextResponse.json({ items });
    } else if (reportType === "consumption") {
      const consumption = await InventoryDAO.getDepartmentConsumptionReport(ctx, {
        departmentId,
        startDate,
        endDate,
      });
      return NextResponse.json({ consumption });
    } else if (reportType === "sales") {
      const sales = await InventoryDAO.getStudentStoreSalesReport(ctx, {
        academicYearId,
        termId,
        startDate,
        endDate,
      });
      return NextResponse.json({ sales });
    } else if (reportType === "ledger") {
      const movements = await InventoryDAO.getStockMovementLedger(ctx, {
        storeId,
        itemId,
        startDate,
        endDate,
      });
      return NextResponse.json({ movements });
    } else {
      return new NextResponse("Invalid report type", { status: 400 });
    }
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
