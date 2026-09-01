import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { FeeTypeDAO } from "@/lib/dao/fee-type.dao";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const feeTypes = await FeeTypeDAO.list(ctx);
    return NextResponse.json(feeTypes);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const feeType = await FeeTypeDAO.create(ctx, {
      name: data.name,
      code: data.code || undefined,
      description: data.description || undefined,
      isActive: data.isActive !== undefined ? data.isActive : true
    });

    return NextResponse.json(feeType);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
