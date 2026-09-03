import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { SupplierPaymentDAO } from "@/lib/dao/supplier-payment.dao";
import { SupplierPaymentStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const supplierId = searchParams.get("supplierId") || undefined;
    const treasuryAccountId = searchParams.get("treasuryAccountId") || undefined;
    const status = (searchParams.get("status") as SupplierPaymentStatus) || undefined;
    const search = searchParams.get("search") || undefined;

    const payments = await SupplierPaymentDAO.listPayments(ctx, { supplierId, treasuryAccountId, status, search });
    return NextResponse.json({ payments });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const payment = await SupplierPaymentDAO.disbursePayment(ctx, {
      supplierId: body.supplierId,
      treasuryAccountId: body.treasuryAccountId,
      paymentDate: body.paymentDate,
      paymentMethod: body.paymentMethod,
      amountToDisburse: body.amountToDisburse,
      referenceNumber: body.referenceNumber,
      notes: body.notes,
      whtDeductedAmount: body.whtDeductedAmount,
      discountTakenAmount: body.discountTakenAmount,
      allocations: body.allocations
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
