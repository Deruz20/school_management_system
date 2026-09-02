import { NextRequest, NextResponse } from 'next/server';
import { SchoolPayDAO } from '@/lib/dao/schoolpay.dao';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const fromDate = body.from ? new Date(body.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = body.to ? new Date(body.to) : new Date();

    const result = await SchoolPayDAO.syncTransactions(ctx, fromDate, toDate);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
