import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { APReportsDAO } from "@/lib/dao/ap-reports.dao";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const report = await APReportsDAO.getGRNIAccrualSchedule(ctx);
    return NextResponse.json(report);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
