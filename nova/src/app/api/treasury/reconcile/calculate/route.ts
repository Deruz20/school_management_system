import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const accountId = searchParams.get("accountId");
    const statementId = searchParams.get("statementId");

    if (!accountId || !statementId) {
      return new NextResponse("accountId and statementId are required", { status: 400 });
    }

    const calculation = await TreasuryDAO.calculateBankReconciliation(ctx, accountId, statementId);

    return NextResponse.json({ calculation });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
