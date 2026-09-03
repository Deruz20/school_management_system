import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { GLEngineDAO } from "@/lib/dao/gl.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;

    const postedJournal = await GLEngineDAO.approveDraftManualJournal(ctx, id);

    return NextResponse.json({ journal: postedJournal }, { status: 200 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
