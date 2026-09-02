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

    const budget = await BudgetDAO.getBudgetDetail(ctx, id);
    if (!budget) {
      return new NextResponse("Budget not found", { status: 404 });
    }

    return NextResponse.json({ budget });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json();

    const budget = await BudgetDAO.updateDraftBudget(ctx, {
      id,
      title: data.title,
      description: data.description,
      items: data.items,
    });

    return NextResponse.json({ budget });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;

    const result = await BudgetDAO.deleteDraftBudget(ctx, id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
