import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ExpenseDAO } from "@/lib/dao/expense.dao";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const voided = await ExpenseDAO.voidExpense(ctx, id, body.reason);
    return NextResponse.json(voided);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
