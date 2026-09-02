import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const vehicleId = searchParams.get("vehicleId") || undefined;
    const driverId = searchParams.get("driverId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const fuelLogs = await TransportDAO.listFuelLogs(ctx, {
      vehicleId,
      driverId,
      startDate,
      endDate,
    });

    return NextResponse.json({ fuelLogs });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const fuelLog = await TransportDAO.recordFuelLog(ctx, {
      vehicleId: data.vehicleId,
      driverId: data.driverId,
      logDate: data.logDate,
      odometerKm: Number(data.odometerKm),
      litersFilled: data.litersFilled,
      unitPrice: data.unitPrice,
      totalCost: data.totalCost,
      fuelStation: data.fuelStation,
      receiptNumber: data.receiptNumber,
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      createExpenseVoucher: data.createExpenseVoucher,
    });

    return NextResponse.json({ fuelLog }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
