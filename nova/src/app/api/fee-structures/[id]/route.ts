import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { FeeStructureDAO } from "@/lib/dao/fee-structure.dao";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const structure = await FeeStructureDAO.getById(ctx, id);
    if (!structure) {
      return new NextResponse("Fee structure not found", { status: 404 });
    }
    return NextResponse.json(structure);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const data = await req.json();

    const updated = await FeeStructureDAO.update(ctx, id, {
      name: data.name,
      description: data.description,
      currency: data.currency,
      isActive: data.isActive,
      items: data.items
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const res = await FeeStructureDAO.delete(ctx, id);
    return NextResponse.json(res);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
