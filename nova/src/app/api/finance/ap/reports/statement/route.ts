import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { APReportsDAO } from "@/lib/dao/ap-reports.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");
    if (!supplierId) throw new Error("supplierId is required.");

    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const statement = await APReportsDAO.getSupplierStatement(ctx, supplierId, startDate, endDate);
    return NextResponse.json(statement);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const imported = await APReportsDAO.importAndMatchStatement(ctx, body.supplierId, {
      statementDate: body.statementDate,
      statementRef: body.statementRef,
      openingBalance: body.openingBalance,
      closingBalance: body.closingBalance,
      lines: body.lines
    });

    return NextResponse.json({ statementImport: imported }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
