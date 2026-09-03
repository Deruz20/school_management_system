import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { SupplierDAO } from "@/lib/dao/supplier.dao";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const supplier = await SupplierDAO.getSupplier(ctx, id);
    return NextResponse.json({ supplier });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const supplier = await SupplierDAO.updateSupplier(ctx, id, body);
    return NextResponse.json({ supplier });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
