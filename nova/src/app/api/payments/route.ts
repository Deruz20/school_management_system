import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { PaymentDAO } from "@/lib/dao/payment.dao";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId") || undefined;
    const statusParam = url.searchParams.get("status") as PaymentStatus | null;
    const status = statusParam || undefined;
    const methodParam = url.searchParams.get("paymentMethod") as PaymentMethod | null;
    const paymentMethod = methodParam || undefined;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;
    const page = url.searchParams.get("page") ? parseInt(url.searchParams.get("page")!, 10) : 1;
    const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 20;

    const result = await PaymentDAO.listPayments(ctx, {
      studentId,
      status,
      paymentMethod,
      startDate,
      endDate,
      page,
      limit
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const result = await PaymentDAO.recordPayment(ctx, {
      studentId: data.studentId,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      paymentDate: data.paymentDate,
      externalReference: data.externalReference || null,
      payerName: data.payerName || null,
      payerPhone: data.payerPhone || null,
      notes: data.notes || null,
      idempotencyKey: data.idempotencyKey || null,
      manualAllocations: data.manualAllocations || undefined
    });

    const headers: Record<string, string> = {};
    if (result.isReplay) {
      headers["Idempotent-Replay"] = "true";
    }

    return NextResponse.json(result.payment, {
      status: result.isReplay ? 200 : 201,
      headers
    });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
