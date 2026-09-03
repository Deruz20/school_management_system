import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { StudentLifecycleDAO } from "@/lib/dao/student-lifecycle.dao";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const history = await StudentLifecycleDAO.getLifecycleHistory(ctx, id);
    return NextResponse.json(history);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await StudentLifecycleDAO.transitionStatus(ctx, {
      studentId: id,
      targetStatus: data.targetStatus,
      reason: data.reason,
      notes: data.notes,
      clearanceId: data.clearanceId,
      effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
