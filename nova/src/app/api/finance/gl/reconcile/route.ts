import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { GLEngineDAO } from "@/lib/dao/gl.dao";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const reconciliation = await GLEngineDAO.reconcileSubledgers(ctx);
    return NextResponse.json({ reconciliation });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
