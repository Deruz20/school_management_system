import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InvoiceDAO } from "@/lib/dao/invoice.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await InvoiceDAO.generateInvoicesForClass(ctx, {
      classId: data.classId,
      academicYearId: data.academicYearId,
      termId: data.termId || null,
      feeStructureId: data.feeStructureId,
      dueDate: data.dueDate,
      notes: data.notes || null
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
