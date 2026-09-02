import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json();

    const session = await TreasuryDAO.recordShiftCashCountAndClose(ctx, {
      sessionId: id,
      actualCashCounted: data.actualCashCounted,
      denominationsJson: data.denominationsJson,
      varianceNotes: data.varianceNotes,
      supervisorWitnessId: data.supervisorWitnessId,
      sweepToSafe: data.sweepToSafe,
      safeAccountId: data.safeAccountId,
    });

    return NextResponse.json({ session });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
