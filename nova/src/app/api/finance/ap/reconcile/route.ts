import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { APReportsDAO } from "@/lib/dao/ap-reports.dao";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const reconciliation = await APReportsDAO.reconcileAPSubledger(ctx);
    return NextResponse.json(reconciliation);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
