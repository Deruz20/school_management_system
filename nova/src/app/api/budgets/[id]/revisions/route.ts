import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { BudgetDAO } from "@/lib/dao/budget.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const revision = await BudgetDAO.createRevision(ctx, {
      budgetId: id,
      title: body.title,
      reason: body.reason,
      items: body.items || [],
    });

    return NextResponse.json({ revision }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
