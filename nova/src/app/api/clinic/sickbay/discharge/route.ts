import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ClinicDAO } from "@/lib/dao/clinic.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const discharged = await ClinicDAO.dischargeFromSickbay(ctx, {
      admissionId: data.admissionId,
      dischargeCondition: data.dischargeCondition,
      outcome: data.outcome,
      notes: data.notes,
    });

    return NextResponse.json(discharged);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
