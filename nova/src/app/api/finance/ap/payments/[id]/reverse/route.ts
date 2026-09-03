import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { SupplierPaymentDAO } from "@/lib/dao/supplier-payment.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const payment = await SupplierPaymentDAO.reversePayment(ctx, id, body.reason || "Payment reversal");
    return NextResponse.json({ payment });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
