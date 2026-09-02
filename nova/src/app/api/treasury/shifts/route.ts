import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";
import { SessionStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const cashierId = searchParams.get("cashierId") || undefined;
    const status = (searchParams.get("status") as SessionStatus) || undefined;

    const sessions = await TreasuryDAO.getShiftSessions(ctx, {
      cashierId,
      status,
    });

    return NextResponse.json({ sessions });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const session = await TreasuryDAO.openShiftSession(ctx, {
      tillAccountId: data.tillAccountId,
      openingFloat: data.openingFloat,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
