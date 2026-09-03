import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { SupplierInvoiceDAO } from "@/lib/dao/supplier-invoice.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const invoice = await SupplierInvoiceDAO.approveInvoice(ctx, id);
    return NextResponse.json({ invoice });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
