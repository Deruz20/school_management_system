import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ClinicDAO } from "@/lib/dao/clinic.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const record = await ClinicDAO.dispenseMedicine(ctx, {
      encounterId: data.encounterId,
      itemId: data.itemId,
      storeId: data.storeId,
      quantity: Number(data.quantity),
      dosageInstructions: data.dosageInstructions,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
