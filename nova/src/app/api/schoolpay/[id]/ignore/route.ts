import { NextRequest, NextResponse } from 'next/server';
import { SchoolPayDAO } from '@/lib/dao/schoolpay.dao';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await context.params;
    const body = await req.json();

    if (!body.reason || body.reason.trim().length < 5) {
      return NextResponse.json(
        { error: 'A valid reason of at least 5 characters is required to ignore a transaction.' },
        { status: 400 }
      );
    }

    const result = await SchoolPayDAO.ignoreTransaction(ctx, id, body.reason.trim());
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
