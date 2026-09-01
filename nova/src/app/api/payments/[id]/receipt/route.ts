import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { PaymentDAO } from "@/lib/dao/payment.dao";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;

    const receipt = await PaymentDAO.getReceipt(ctx, id);
    return NextResponse.json(receipt);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 404 });
  }
}
