import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DisciplineDAO } from "@/lib/dao/discipline.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json().catch(() => ({}));

    const reinstated = await DisciplineDAO.reinstateStudent(ctx, id, data?.notes);
    return NextResponse.json(reinstated);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
