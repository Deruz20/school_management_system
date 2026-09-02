import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;

    const account = await TreasuryDAO.getTreasuryAccountById(ctx, id);
    const movements = await TreasuryDAO.getCashbookMovements(ctx, id);

    return NextResponse.json({ account, movements });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
