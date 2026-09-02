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

    const voucher = await TreasuryDAO.disbursePettyCashVoucher(ctx, id);

    return NextResponse.json({ voucher });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
