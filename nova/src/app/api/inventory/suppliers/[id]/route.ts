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
    const supplier = await InventoryDAO.getSupplier(ctx, id);
    return NextResponse.json({ supplier });
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

    const supplier = await InventoryDAO.updateSupplier(ctx, id, {
      name: data.name,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email,
      address: data.address,
      taxIdNumber: data.taxIdNumber,
      paymentTerms: data.paymentTerms,
      notes: data.notes,
      isActive: data.isActive,
    });

    return NextResponse.json({ supplier });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
