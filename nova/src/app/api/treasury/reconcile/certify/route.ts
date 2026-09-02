import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const reconciliation = await TreasuryDAO.certifyAndLockBankReconciliation(ctx, {
      accountId: data.accountId,
      statementId: data.statementId,
      notes: data.notes,
    });

    return NextResponse.json({ reconciliation }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
