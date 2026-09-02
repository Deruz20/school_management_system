import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const isActive = searchParams.has("isActive")
      ? searchParams.get("isActive") === "true"
      : undefined;

    const drivers = await TransportDAO.listDrivers(ctx, { isActive });
    return NextResponse.json({ drivers });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const driver = await TransportDAO.registerDriver(ctx, {
      employeeId: data.employeeId,
      fullName: data.fullName,
      phone: data.phone,
      licenseNumber: data.licenseNumber,
      licenseClass: data.licenseClass,
      licenseExpiry: data.licenseExpiry,
      notes: data.notes,
    });

    return NextResponse.json({ driver }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
