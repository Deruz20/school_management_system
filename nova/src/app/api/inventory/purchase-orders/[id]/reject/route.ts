import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json().catch(() => ({}));

    const purchaseOrder = await InventoryDAO.rejectPurchaseOrder(ctx, id, data.reason);
    return NextResponse.json({ purchaseOrder });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
