import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { BudgetDAO } from "@/lib/dao/budget.dao";
import { BudgetStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const academicYearId = searchParams.get('academicYearId') || undefined;
    const termId = searchParams.get('termId') || undefined;
    const status = searchParams.get('status') as BudgetStatus | undefined;
    const search = searchParams.get('search') || undefined;

    const budgets = await BudgetDAO.listBudgets(ctx, {
      academicYearId,
      termId,
      status,
      search,
    });

    return NextResponse.json({ budgets });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const budget = await BudgetDAO.createBudget(ctx, {
      academicYearId: data.academicYearId,
      termId: data.termId,
      title: data.title,
      description: data.description,
      items: data.items || [],
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
