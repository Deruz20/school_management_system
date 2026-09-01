import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DiscountDAO } from "@/lib/dao/discount.dao";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const discount = await DiscountDAO.getById(ctx, id);
    return NextResponse.json(discount);
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

    const updated = await DiscountDAO.update(ctx, id, {
      feeTypeId: data.feeTypeId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      discountType: data.discountType,
      value: data.value,
      reason: data.reason,
      isActive: data.isActive
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await DiscountDAO.delete(ctx, id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
