import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { TreasuryDAO } from "@/lib/dao/treasury.dao";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const imprests = await TreasuryDAO.getPettyCashImprests(ctx);
    return NextResponse.json({ imprests });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const imprest = await TreasuryDAO.createPettyCashImprest(ctx, {
      accountId: data.accountId,
      custodianId: data.custodianId,
      name: data.name,
      floatCeiling: data.floatCeiling,
      replenishmentThreshold: data.replenishmentThreshold,
      departmentId: data.departmentId,
    });

    return NextResponse.json({ imprest }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
