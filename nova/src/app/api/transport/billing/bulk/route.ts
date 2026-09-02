import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    if (!data.academicYearId || !data.termId) {
      return new NextResponse("academicYearId and termId are required.", { status: 400 });
    }

    const result = await TransportDAO.bulkBillTransportFees(ctx, {
      academicYearId: data.academicYearId,
      termId: data.termId,
      routeId: data.routeId,
      dueDate: data.dueDate,
    });

    return NextResponse.json({
      billedCount: result.billedCount,
      totalBilledAmount: result.totalBilledAmount.toString(),
      invoiceItemIds: result.invoiceItemIds,
    });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
