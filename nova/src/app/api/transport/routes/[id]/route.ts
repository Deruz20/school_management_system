import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;

    const route = await TransportDAO.getRouteById(ctx, id);
    return NextResponse.json({ route });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 404 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json();

    const route = await TransportDAO.updateRoute(ctx, id, {
      name: data.name,
      description: data.description,
      destinationZone: data.destinationZone,
      twoWayFee: data.twoWayFee,
      oneWayFee: data.oneWayFee,
      isActive: data.isActive,
    });

    return NextResponse.json({ route });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
