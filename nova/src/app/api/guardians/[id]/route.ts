import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { GuardianDAO } from "@/lib/dao/guardian.dao";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const guardian = await GuardianDAO.getGuardian(ctx, id);
    return NextResponse.json(guardian);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
