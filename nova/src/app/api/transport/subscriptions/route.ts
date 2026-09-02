import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TransportDAO } from "@/lib/dao/transport.dao";
import { TransportSubscriptionStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const routeId = searchParams.get("routeId") || undefined;
    const studentId = searchParams.get("studentId") || undefined;
    const academicYearId = searchParams.get("academicYearId") || undefined;
    const termId = searchParams.get("termId") || undefined;
    const status = (searchParams.get("status") as TransportSubscriptionStatus) || undefined;
    const classId = searchParams.get("classId") || undefined;

    const subscriptions = await TransportDAO.listSubscriptions(ctx, {
      routeId,
      studentId,
      academicYearId,
      termId,
      status,
      classId,
    });

    return NextResponse.json({ subscriptions });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const subscription = await TransportDAO.subscribeStudent(ctx, {
      studentId: data.studentId,
      routeId: data.routeId,
      stopId: data.stopId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      subscriptionType: data.subscriptionType,
      overrideJustification: data.overrideJustification,
      notes: data.notes,
    });

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
