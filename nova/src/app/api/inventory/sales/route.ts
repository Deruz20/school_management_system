import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const studentId = searchParams.get("studentId") || undefined;
    const storeId = searchParams.get("storeId") || undefined;
    const academicYearId = searchParams.get("academicYearId") || undefined;
    const termId = searchParams.get("termId") || undefined;

    const sales = await InventoryDAO.listStudentStoreSales(ctx, {
      studentId,
      storeId,
      academicYearId,
      termId,
    });

    return NextResponse.json({ sales });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const sale = await InventoryDAO.recordStudentStoreSale(ctx, {
      studentId: data.studentId,
      storeId: data.storeId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      isInvoiceCharge: data.isInvoiceCharge,
      invoiceId: data.invoiceId,
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      items: data.items,
    });

    return NextResponse.json({ sale }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
