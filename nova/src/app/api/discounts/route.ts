import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DiscountDAO } from "@/lib/dao/discount.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId") || undefined;
    const feeTypeId = url.searchParams.get("feeTypeId") || undefined;
    const academicYearId = url.searchParams.get("academicYearId") || undefined;
    const termId = url.searchParams.get("termId") || undefined;
    const isActiveParam = url.searchParams.get("isActive");
    const isActive = isActiveParam !== null ? isActiveParam === "true" : undefined;

    const discounts = await DiscountDAO.list(ctx, {
      studentId,
      feeTypeId,
      academicYearId,
      termId,
      isActive
    });
    return NextResponse.json(discounts);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const discount = await DiscountDAO.create(ctx, {
      studentId: data.studentId,
      feeTypeId: data.feeTypeId || null,
      academicYearId: data.academicYearId || null,
      termId: data.termId || null,
      discountType: data.discountType,
      value: data.value,
      reason: data.reason,
      isActive: data.isActive !== undefined ? data.isActive : true
    });

    return NextResponse.json(discount);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
