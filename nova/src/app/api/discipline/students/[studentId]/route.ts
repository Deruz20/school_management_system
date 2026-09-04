import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DisciplineDAO } from "@/lib/dao/discipline.dao";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { studentId } = await params;
    const history = await DisciplineDAO.getStudentDisciplineHistory(ctx, studentId);
    return NextResponse.json(history);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
