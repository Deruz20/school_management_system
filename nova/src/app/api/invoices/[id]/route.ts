import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InvoiceDAO } from "@/lib/dao/invoice.dao";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const invoice = await InvoiceDAO.getById(ctx, id);
    return NextResponse.json(invoice);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
