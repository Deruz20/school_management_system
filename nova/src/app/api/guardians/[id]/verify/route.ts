import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { GuardianDAO } from "@/lib/dao/guardian.dao";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const verified = await GuardianDAO.verifyGuardian(ctx, id);
    return NextResponse.json(verified);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
