import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json();

    const stop = await TransportDAO.addRouteStop(ctx, id, {
      stopName: data.stopName,
      landmark: data.landmark,
      sequenceOrder: data.sequenceOrder,
      morningPickupTime: data.morningPickupTime,
      eveningDropTime: data.eveningDropTime,
      surchargeAmount: data.surchargeAmount,
    });

    return NextResponse.json({ stop }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
