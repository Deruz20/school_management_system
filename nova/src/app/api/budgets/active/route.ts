import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { BudgetDAO } from "@/lib/dao/budget.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const academicYearId = searchParams.get('academicYearId') || undefined;
    const termId = searchParams.get('termId') || undefined;
    const dateStr = searchParams.get('date');
    const date = dateStr ? new Date(dateStr) : undefined;

    const budget = await BudgetDAO.getActiveApprovedBudget(ctx, {
      academicYearId,
      termId,
      date,
    });

    return NextResponse.json({ budget });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
