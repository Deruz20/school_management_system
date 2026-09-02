import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";
import { VehicleStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const status = (searchParams.get("status") as VehicleStatus) || undefined;
    const vehicles = await TransportDAO.listVehicles(ctx, { status });

    return NextResponse.json({ vehicles });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const vehicle = await TransportDAO.registerVehicle(ctx, {
      registrationNumber: data.registrationNumber,
      makeModel: data.makeModel,
      capacity: Number(data.capacity),
      fuelType: data.fuelType,
      status: data.status,
      insuranceExpiry: data.insuranceExpiry,
      inspectionDueDate: data.inspectionDueDate,
      notes: data.notes,
    });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
