import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ExpenseDAO } from "@/lib/dao/expense.dao";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const expense = await ExpenseDAO.getExpense(ctx, id);
    return NextResponse.json(expense);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
