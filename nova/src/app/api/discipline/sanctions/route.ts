import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DisciplineDAO } from "@/lib/dao/discipline.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const sanction = await DisciplineDAO.prescribeSanction(ctx, {
      hearingId: data.hearingId,
      studentId: data.studentId,
      sanctionType: data.sanctionType,
      startDate: data.startDate,
      endDate: data.endDate,
      terms: data.terms,
      demeritPoints: data.demeritPoints ? Number(data.demeritPoints) : undefined,
    });

    return NextResponse.json(sanction, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
