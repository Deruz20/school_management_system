import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { GLEngineDAO } from "@/lib/dao/gl.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json().catch(() => ({}));
    const cutoffDate = data.cutoffDate ? new Date(data.cutoffDate) : undefined;

    const result = await GLEngineDAO.bootstrapOpeningBalances(ctx, cutoffDate);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
