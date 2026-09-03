import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { SupplierCreditNoteDAO } from "@/lib/dao/supplier-credit-note.dao";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const creditNote = await SupplierCreditNoteDAO.allocateCreditNote(
      ctx,
      id,
      body.invoiceId,
      body.amountToApply
    );
    return NextResponse.json({ creditNote });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
