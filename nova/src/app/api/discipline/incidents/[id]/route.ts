import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DisciplineDAO } from "@/lib/dao/discipline.dao";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const incident = await DisciplineDAO.getIncidentById(ctx, id);
    return NextResponse.json(incident);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
