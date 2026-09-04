import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ClinicDAO } from "@/lib/dao/clinic.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const admission = await ClinicDAO.admitToSickbay(ctx, {
      encounterId: data.encounterId,
      bedNumber: data.bedNumber,
      notes: data.notes,
    });

    return NextResponse.json(admission, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
