import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { InvoiceDAO } from "@/lib/dao/invoice.dao";
import { InvoiceStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId") || undefined;
    const classId = url.searchParams.get("classId") || undefined;
    const academicYearId = url.searchParams.get("academicYearId") || undefined;
    const termId = url.searchParams.get("termId") || undefined;
    const statusParam = url.searchParams.get("status") as InvoiceStatus | null;
    const status = statusParam || undefined;

    const invoices = await InvoiceDAO.list(ctx, {
      studentId,
      classId,
      academicYearId,
      termId,
      status
    });

    return NextResponse.json(invoices);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const invoice = await InvoiceDAO.createIndividualInvoice(ctx, {
      studentId: data.studentId,
      enrollmentId: data.enrollmentId,
      academicYearId: data.academicYearId,
      termId: data.termId || null,
      feeStructureId: data.feeStructureId || null,
      dueDate: data.dueDate,
      notes: data.notes || null,
      items: data.items || undefined
    });

    return NextResponse.json(invoice);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
