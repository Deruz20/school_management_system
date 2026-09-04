import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ExeatDAO } from "@/lib/dao/exeat.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;

    const approved = await ExeatDAO.approveExeat(ctx, id);
    return NextResponse.json(approved);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
