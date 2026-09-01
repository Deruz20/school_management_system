import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ExpenseCategoryDAO } from "@/lib/dao/expense-category.dao";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const category = await ExpenseCategoryDAO.getById(ctx, id);
    return NextResponse.json(category);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json();

    const category = await ExpenseCategoryDAO.update(ctx, id, {
      name: data.name,
      code: data.code,
      description: data.description,
      isActive: data.isActive
    });

    return NextResponse.json(category);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
