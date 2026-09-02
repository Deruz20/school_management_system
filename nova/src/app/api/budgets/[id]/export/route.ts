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

    const csv = await BudgetDAO.generateVarianceCsvExport(ctx, id);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="budget_variance_${id}.csv"`,
      },
    });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
