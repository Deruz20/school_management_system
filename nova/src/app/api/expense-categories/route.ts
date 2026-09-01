import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ExpenseCategoryDAO } from "@/lib/dao/expense-category.dao";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const categories = await ExpenseCategoryDAO.list(ctx, includeInactive);
    return NextResponse.json(categories);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const category = await ExpenseCategoryDAO.create(ctx, {
      name: data.name,
      code: data.code,
      description: data.description,
      isActive: data.isActive
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
