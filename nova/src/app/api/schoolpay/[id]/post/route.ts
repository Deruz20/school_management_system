import { NextRequest, NextResponse } from 'next/server';
import { SchoolPayDAO } from '@/lib/dao/schoolpay.dao';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await context.params;
    const result = await SchoolPayDAO.postMatchedTransaction(ctx, id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
