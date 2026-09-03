import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { SupplierCreditNoteDAO } from "@/lib/dao/supplier-credit-note.dao";
import { SupplierCreditNoteStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const supplierId = searchParams.get("supplierId") || undefined;
    const status = (searchParams.get("status") as SupplierCreditNoteStatus) || undefined;
    const search = searchParams.get("search") || undefined;

    const creditNotes = await SupplierCreditNoteDAO.listCreditNotes(ctx, { supplierId, status, search });
    return NextResponse.json({ creditNotes });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const creditNote = await SupplierCreditNoteDAO.createCreditNote(ctx, {
      vendorCreditNoteRef: body.vendorCreditNoteRef,
      supplierId: body.supplierId,
      originalInvoiceId: body.originalInvoiceId,
      fiscalPeriodId: body.fiscalPeriodId,
      creditNoteDate: body.creditNoteDate,
      reason: body.reason,
      taxAmount: body.taxAmount,
      lines: body.lines
    });

    return NextResponse.json({ creditNote }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
