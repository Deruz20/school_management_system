import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";
import { InventoryItemCategory } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const category = (searchParams.get("category") as InventoryItemCategory) || undefined;
    const search = searchParams.get("search") || undefined;
    const lowStockOnly = searchParams.get("lowStockOnly") === "true";
    const isActive = searchParams.has("isActive")
      ? searchParams.get("isActive") === "true"
      : undefined;

    const items = await InventoryDAO.listItems(ctx, {
      category,
      search,
      lowStockOnly,
      isActive,
    });

    return NextResponse.json({ items });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const item = await InventoryDAO.createItem(ctx, {
      code: data.code,
      name: data.name,
      category: data.category,
      unitOfMeasure: data.unitOfMeasure,
      unitCostPrice: data.unitCostPrice,
      sellingPrice: data.sellingPrice,
      reorderLevel: data.reorderLevel,
      description: data.description,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
