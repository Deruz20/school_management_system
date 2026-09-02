import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InventoryDAO } from "@/lib/dao/inventory.dao";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const item = await InventoryDAO.getItem(ctx, id);
    return NextResponse.json({ item });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json();

    const item = await InventoryDAO.updateItem(ctx, id, {
      name: data.name,
      category: data.category,
      unitOfMeasure: data.unitOfMeasure,
      unitCostPrice: data.unitCostPrice,
      sellingPrice: data.sellingPrice,
      reorderLevel: data.reorderLevel,
      description: data.description,
      isActive: data.isActive,
    });

    return NextResponse.json({ item });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
