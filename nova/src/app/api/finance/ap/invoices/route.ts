import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { SupplierInvoiceDAO } from "@/lib/dao/supplier-invoice.dao";
import { SupplierInvoiceStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const supplierId = searchParams.get("supplierId") || undefined;
    const status = (searchParams.get("status") as SupplierInvoiceStatus) || undefined;
    const fiscalPeriodId = searchParams.get("fiscalPeriodId") || undefined;
    const search = searchParams.get("search") || undefined;

    const invoices = await SupplierInvoiceDAO.listInvoices(ctx, { supplierId, status, fiscalPeriodId, search });
    return NextResponse.json({ invoices });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const invoice = await SupplierInvoiceDAO.createInvoice(ctx, {
      vendorInvoiceNumber: body.vendorInvoiceNumber,
      supplierId: body.supplierId,
      poId: body.poId,
      grnId: body.grnId,
      fiscalPeriodId: body.fiscalPeriodId,
      invoiceDate: body.invoiceDate,
      dueDate: body.dueDate,
      supplyCategory: body.supplyCategory,
      discountAmount: body.discountAmount,
      efrisFiscalDocNumber: body.efrisFiscalDocNumber,
      efrisVerificationCode: body.efrisVerificationCode,
      isOpeningBalance: body.isOpeningBalance,
      notes: body.notes,
      lines: body.lines
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
