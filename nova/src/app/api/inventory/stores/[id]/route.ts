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
    const store = await InventoryDAO.getStore(ctx, id);
    return NextResponse.json({ store });
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

    const store = await InventoryDAO.updateStore(ctx, id, {
      name: data.name,
      storeType: data.storeType,
      location: data.location,
      managerId: data.managerId,
      isActive: data.isActive,
    });

    return NextResponse.json({ store });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
