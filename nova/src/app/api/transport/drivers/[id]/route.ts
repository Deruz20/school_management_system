import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json();

    const driver = await TransportDAO.updateDriver(ctx, id, {
      employeeId: data.employeeId,
      fullName: data.fullName,
      phone: data.phone,
      licenseNumber: data.licenseNumber,
      licenseClass: data.licenseClass,
      licenseExpiry: data.licenseExpiry,
      isActive: data.isActive,
    });

    return NextResponse.json({ driver });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
