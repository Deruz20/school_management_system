import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { FeeTypeDAO } from "@/lib/dao/fee-type.dao";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const feeType = await FeeTypeDAO.getById(ctx, id);
    if (!feeType) {
      return new NextResponse("Fee type not found", { status: 404 });
    }
    return NextResponse.json(feeType);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const data = await req.json();

    const updated = await FeeTypeDAO.update(ctx, id, {
      name: data.name,
      code: data.code,
      description: data.description,
      isActive: data.isActive
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
    const res = await FeeTypeDAO.delete(ctx, id);
    return NextResponse.json(res);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
