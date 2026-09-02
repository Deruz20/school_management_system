import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await InventoryDAO.recordStocktakeAdjustment(ctx, {
      storeId: data.storeId,
      itemId: data.itemId,
      physicalCount: data.physicalCount,
      reason: data.reason,
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
