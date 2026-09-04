import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ClinicDAO } from "@/lib/dao/clinic.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const referral = await ClinicDAO.referStudent(ctx, {
      encounterId: data.encounterId,
      externalFacilityName: data.externalFacilityName,
      referralReason: data.referralReason,
      ambulanceDispatched: data.ambulanceDispatched,
      escortStaffId: data.escortStaffId,
      guardianNotifiedAt: data.guardianNotifiedAt,
      guardianNotificationNotes: data.guardianNotificationNotes,
    });

    return NextResponse.json(referral, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
