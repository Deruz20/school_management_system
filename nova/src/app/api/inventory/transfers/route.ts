import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await InventoryDAO.transferStock(ctx, {
      sourceStoreId: data.sourceStoreId,
      destStoreId: data.destStoreId,
      itemId: data.itemId,
      quantity: data.quantity,
      reason: data.reason,
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
