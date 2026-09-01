import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ExpenseDAO } from "@/lib/dao/expense.dao";
import { PaymentMethod, ExpenseStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const categoryId = searchParams.get('categoryId') || undefined;
    const paymentMethod = searchParams.get('paymentMethod') as PaymentMethod | undefined;
    const status = searchParams.get('status') as ExpenseStatus | undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;

    const [result, summary] = await Promise.all([
      ExpenseDAO.listExpenses(ctx, {
        categoryId,
        paymentMethod,
        status,
        startDate,
        endDate,
        search,
        page,
        limit
      }),
      ExpenseDAO.getSummary(ctx)
    ]);

    return NextResponse.json({
      ...result,
      summary
    });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const idempotencyHeader = req.headers.get('x-idempotency-key');
    const idempotencyKey = idempotencyHeader || data.idempotencyKey;

    const result = await ExpenseDAO.createExpense(ctx, {
      categoryId: data.categoryId,
      title: data.title,
      amount: data.amount,
      expenseDate: data.expenseDate,
      paymentMethod: data.paymentMethod,
      vendorName: data.vendorName,
      receiptRef: data.receiptRef,
      notes: data.notes,
      idempotencyKey
    });

    return NextResponse.json(result.expense, {
      status: result.isReplay ? 200 : 201,
      headers: result.isReplay ? { 'Idempotent-Replay': 'true' } : {}
    });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
