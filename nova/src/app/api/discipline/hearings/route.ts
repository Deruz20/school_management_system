import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DisciplineDAO } from "@/lib/dao/discipline.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const hearing = await DisciplineDAO.recordHearing(ctx, {
      incidentId: data.incidentId,
      hearingDate: data.hearingDate,
      location: data.location,
      panelChairId: data.panelChairId,
      panelMembers: data.panelMembers,
      studentPlea: data.studentPlea,
      guardianPresent: data.guardianPresent,
      guardianId: data.guardianId,
      hearingMinutes: data.hearingMinutes,
      findings: data.findings,
    });

    return NextResponse.json(hearing, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
