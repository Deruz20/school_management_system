import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { RequirementsDAO } from "@/lib/dao/requirements.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await RequirementsDAO.monetizeRequirementItem(ctx, {
      studentRequirementItemId: data.studentRequirementItemId,
      monetizedQuantity: data.monetizedQuantity,
      paymentMethod: data.paymentMethod,
      payerName: data.payerName,
      payerPhone: data.payerPhone,
      notes: data.notes,
      idempotencyKey: data.idempotencyKey
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
