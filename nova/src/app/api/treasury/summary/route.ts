import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const summary = await TreasuryDAO.getLiquiditySummary(ctx);

    return NextResponse.json({ summary });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
