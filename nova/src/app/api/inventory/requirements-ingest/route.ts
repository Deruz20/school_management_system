import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await InventoryDAO.ingestRequirementHandovers(ctx, {
      storeId: data.storeId,
      itemId: data.itemId,
      handoverLogIds: data.handoverLogIds,
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
