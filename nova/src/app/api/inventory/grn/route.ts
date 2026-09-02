import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const poId = searchParams.get("poId") || undefined;
    const supplierId = searchParams.get("supplierId") || undefined;
    const storeId = searchParams.get("storeId") || undefined;

    const grns = await InventoryDAO.listGoodsReceivedNotes(ctx, {
      poId,
      supplierId,
      storeId,
    });

    return NextResponse.json({ grns });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const grn = await InventoryDAO.receiveGoods(ctx, {
      poId: data.poId,
      supplierId: data.supplierId,
      storeId: data.storeId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      deliveryDate: data.deliveryDate,
      supplierInvoiceRef: data.supplierInvoiceRef,
      notes: data.notes,
      expenseCategoryId: data.expenseCategoryId,
      paymentMethod: data.paymentMethod,
      createExpenseVoucher: data.createExpenseVoucher,
      allowOverReceipt: data.allowOverReceipt,
      items: data.items,
    });

    return NextResponse.json({ grn }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
