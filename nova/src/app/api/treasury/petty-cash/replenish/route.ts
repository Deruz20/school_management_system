import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await TreasuryDAO.replenishPettyCashImprest(ctx, data.imprestId, {
      sourceAccountId: data.sourceAccountId,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
