import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";
import { MaintenanceType } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const vehicleId = searchParams.get("vehicleId") || undefined;
    const maintenanceType = (searchParams.get("maintenanceType") as MaintenanceType) || undefined;
    const isVoided = searchParams.has("isVoided")
      ? searchParams.get("isVoided") === "true"
      : undefined;

    const maintenanceLogs = await TransportDAO.listMaintenanceLogs(ctx, {
      vehicleId,
      maintenanceType,
      isVoided,
    });

    return NextResponse.json({ maintenanceLogs });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const maintenanceLog = await TransportDAO.recordMaintenanceLog(ctx, {
      vehicleId: data.vehicleId,
      maintenanceDate: data.maintenanceDate,
      maintenanceType: data.maintenanceType,
      garageName: data.garageName,
      description: data.description,
      partsCost: data.partsCost,
      laborCost: data.laborCost,
      totalCost: data.totalCost,
      odometerAtService: data.odometerAtService ? Number(data.odometerAtService) : undefined,
      nextServiceDate: data.nextServiceDate,
      nextServiceKm: data.nextServiceKm ? Number(data.nextServiceKm) : undefined,
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      createExpenseVoucher: data.createExpenseVoucher,
    });

    return NextResponse.json({ maintenanceLog }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
