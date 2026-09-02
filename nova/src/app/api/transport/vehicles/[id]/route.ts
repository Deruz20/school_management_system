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

    const vehicle = await TransportDAO.getVehicleById(ctx, id);
    return NextResponse.json({ vehicle });
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

    const vehicle = await TransportDAO.updateVehicle(ctx, id, {
      makeModel: data.makeModel,
      capacity: data.capacity !== undefined ? Number(data.capacity) : undefined,
      fuelType: data.fuelType,
      status: data.status,
      insuranceExpiry: data.insuranceExpiry,
      inspectionDueDate: data.inspectionDueDate,
      currentOdometerKm: data.currentOdometerKm !== undefined ? Number(data.currentOdometerKm) : undefined,
      notes: data.notes,
    });

    return NextResponse.json({ vehicle });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
