import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const storeId = searchParams.get("storeId") || undefined;
    const itemId = searchParams.get("itemId") || undefined;

    const where: Prisma.InventoryStoreStockWhereInput = { branchId: ctx.branchId };
    if (storeId) where.storeId = storeId;
    if (itemId) where.itemId = itemId;

    const stocks = await db.inventoryStoreStock.findMany({
      where,
      include: {
        store: true,
        item: true,
      },
      orderBy: [{ store: { name: "asc" } }, { item: { name: "asc" } }],
    });

    return NextResponse.json({ stocks });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
