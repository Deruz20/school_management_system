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

    if (!body?.reason) {
      return new NextResponse("Rejection reason is required", { status: 400 });
    }

    const budget = await BudgetDAO.rejectBudget(ctx, id, body.reason);
    return NextResponse.json({ budget });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
