import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    TreasuryDAO.checkPermission(ctx, "treasury:accounts:read");

    const { searchParams } = new URL(req.url);
    const imprestId = searchParams.get("imprestId") || undefined;

    const vouchers = await db.pettyCashVoucher.findMany({
      where: {
        branchId: ctx.branchId,
        ...(imprestId ? { imprestId } : {}),
      },
      include: {
        imprest: true,
        category: true,
        requester: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ vouchers });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const voucher = await TreasuryDAO.createPettyCashVoucher(ctx, {
      imprestId: data.imprestId,
      purpose: data.purpose,
      categoryId: data.categoryId,
      budgetItemId: data.budgetItemId,
      requestedAmount: data.requestedAmount,
    });

    return NextResponse.json({ voucher }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
