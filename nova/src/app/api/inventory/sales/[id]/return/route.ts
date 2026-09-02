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
    const data = await req.json();

    const result = await InventoryDAO.processStudentSaleReturn(ctx, id, {
      items: data.items,
    });

    return NextResponse.json({ result });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
