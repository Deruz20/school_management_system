import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    if (data.mode === "AUTO") {
      const result = await TreasuryDAO.runDeterministicMatching(
        ctx,
        data.accountId,
        data.statementId
      );
      return NextResponse.json(result);
    } else {
      // Manual match
      const result = await TreasuryDAO.manualMatchLine(ctx, {
        statementLineId: data.statementLineId,
        cashbookMovementIds: data.cashbookMovementIds,
        notes: data.notes,
      });
      return NextResponse.json(result);
    }
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
