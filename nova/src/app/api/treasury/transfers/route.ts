import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const ctx = await requireAuth();
    TreasuryDAO.checkPermission(ctx, "treasury:transfers:initiate");

    const transfers = await db.treasuryTransfer.findMany({
      where: { branchId: ctx.branchId },
      include: {
        fromAccount: true,
        toAccount: true,
        initiatedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ transfers });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await TreasuryDAO.createTreasuryTransfer(ctx, {
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      amount: data.amount,
      transferMethod: data.transferMethod,
      depositSlipNumber: data.depositSlipNumber,
      securityEscortDetails: data.securityEscortDetails,
      notes: data.notes,
      idempotencyKey: data.idempotencyKey,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
