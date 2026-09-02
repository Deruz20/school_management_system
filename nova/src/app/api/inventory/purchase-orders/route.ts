import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";
import { PurchaseOrderStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const supplierId = searchParams.get("supplierId") || undefined;
    const status = (searchParams.get("status") as PurchaseOrderStatus) || undefined;
    const academicYearId = searchParams.get("academicYearId") || undefined;
    const termId = searchParams.get("termId") || undefined;

    const purchaseOrders = await InventoryDAO.listPurchaseOrders(ctx, {
      supplierId,
      status,
      academicYearId,
      termId,
    });

    return NextResponse.json({ purchaseOrders });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const purchaseOrder = await InventoryDAO.createPurchaseOrder(ctx, {
      supplierId: data.supplierId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      expectedDate: data.expectedDate,
      notes: data.notes,
      items: data.items,
    });

    return NextResponse.json({ purchaseOrder }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
