import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { BudgetDAO } from "@/lib/dao/budget.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { revisionId } = await params;
    let allowSingleAdminMode = false;
    try {
      const body = await req.json();
      if (body?.allowSingleAdminMode) allowSingleAdminMode = true;
    } catch {
      // Empty body is valid
    }

    const result = await BudgetDAO.approveRevision(ctx, revisionId, allowSingleAdminMode);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
