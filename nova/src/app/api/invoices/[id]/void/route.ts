import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InvoiceDAO } from "@/lib/dao/invoice.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const data = await req.json();

    const voided = await InvoiceDAO.voidInvoice(ctx, id, data.reason);
    return NextResponse.json(voided);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
