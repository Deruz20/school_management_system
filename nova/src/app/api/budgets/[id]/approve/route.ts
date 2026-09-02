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
    let allowSingleAdminMode = false;
    try {
      const body = await req.json();
      if (body?.allowSingleAdminMode) allowSingleAdminMode = true;
    } catch {
      // Empty body is valid
    }

    const budget = await BudgetDAO.approveBudget(ctx, id, allowSingleAdminMode);
    return NextResponse.json({ budget });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
