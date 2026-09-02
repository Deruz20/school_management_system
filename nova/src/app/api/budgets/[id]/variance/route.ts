import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { BudgetDAO } from "@/lib/dao/budget.dao";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;

    const [variance, revenue] = await Promise.all([
      BudgetDAO.getLiveBudgetVariance(ctx, id),
      BudgetDAO.getRevenueRealization(ctx, id),
    ]);

    return NextResponse.json({
      variance,
      revenue,
    });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
