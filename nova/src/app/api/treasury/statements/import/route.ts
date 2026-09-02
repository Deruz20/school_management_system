import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const statement = await TreasuryDAO.importBankStatement(ctx, {
      accountId: data.accountId,
      statementIdentifier: data.statementIdentifier,
      startDate: data.startDate,
      endDate: data.endDate,
      openingBalance: data.openingBalance,
      closingBalance: data.closingBalance,
      fileContentRaw: data.fileContentRaw || JSON.stringify(data.lines),
      lines: data.lines,
    });

    return NextResponse.json({ statement }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
