import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const routeId = searchParams.get("routeId") || undefined;
    const academicYearId = searchParams.get("academicYearId") || undefined;
    const termId = searchParams.get("termId") || undefined;

    const assignments = await TransportDAO.listVehicleRouteAssignments(ctx, {
      routeId,
      academicYearId,
      termId,
    });

    return NextResponse.json({ assignments });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const assignment = await TransportDAO.createVehicleRouteAssignment(ctx, {
      routeId: data.routeId,
      vehicleId: data.vehicleId,
      driverId: data.driverId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      isPrimary: data.isPrimary,
      notes: data.notes,
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return new NextResponse("Assignment ID is required.", { status: 400 });
    }

    const result = await TransportDAO.deleteVehicleRouteAssignment(ctx, id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
