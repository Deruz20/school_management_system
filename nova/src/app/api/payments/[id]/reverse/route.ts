import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { PaymentDAO } from "@/lib/dao/payment.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const reversed = await PaymentDAO.reversePayment(ctx, id, body.reason);
    return NextResponse.json(reversed);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
