import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; stopId: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { stopId } = await params;
    const data = await req.json();

    const stop = await TransportDAO.updateRouteStop(ctx, stopId, {
      stopName: data.stopName,
      landmark: data.landmark,
      sequenceOrder: data.sequenceOrder,
      morningPickupTime: data.morningPickupTime,
      eveningDropTime: data.eveningDropTime,
      surchargeAmount: data.surchargeAmount,
    });

    return NextResponse.json({ stop });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; stopId: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { stopId } = await params;

    const result = await TransportDAO.deleteRouteStop(ctx, stopId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
