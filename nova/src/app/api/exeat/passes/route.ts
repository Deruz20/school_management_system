import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ExeatDAO } from "@/lib/dao/exeat.dao";
import { ExeatStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId") || undefined;
    const status = url.searchParams.get("status") as ExeatStatus | null;
    const isOverdue = url.searchParams.has("isOverdue") ? url.searchParams.get("isOverdue") === "true" : undefined;

    const passes = await ExeatDAO.listExeatPasses(ctx, {
      studentId,
      status: status || undefined,
      isOverdue,
    });

    return NextResponse.json(passes);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const exeat = await ExeatDAO.requestExeat(ctx, {
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      exeatType: data.exeatType,
      reason: data.reason,
      intendedDeparture: data.intendedDeparture,
      expectedReturn: data.expectedReturn,
      guardianId: data.guardianId,
      guardianConsent: data.guardianConsent,
      guardianConsentMethod: data.guardianConsentMethod,
      accompanyingAdult: data.accompanyingAdult,
    });

    return NextResponse.json(exeat, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
