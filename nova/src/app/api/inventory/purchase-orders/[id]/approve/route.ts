import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const purchaseOrder = await InventoryDAO.approvePurchaseOrder(ctx, id);
    return NextResponse.json({ purchaseOrder });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
