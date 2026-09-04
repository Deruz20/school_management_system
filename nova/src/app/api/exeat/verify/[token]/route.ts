import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ExeatDAO } from "@/lib/dao/exeat.dao";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { token } = await params;
    const exeat = await ExeatDAO.verifyPassByToken(ctx, token);
    return NextResponse.json(exeat);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
