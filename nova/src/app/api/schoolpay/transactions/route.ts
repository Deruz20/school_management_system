import { NextRequest, NextResponse } from 'next/server';
import { SchoolPayDAO } from '@/lib/dao/schoolpay.dao';
import { requireAuth } from '@/lib/auth/require-auth';
import { SchoolPayTxStatus, SchoolPaySourceChannel } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const channel = searchParams.get('channel') as SchoolPaySourceChannel | undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;

    const [txResult, stats] = await Promise.all([
      SchoolPayDAO.getTransactions(ctx, {
        status: status as SchoolPayTxStatus | 'ALL' | undefined,
        search,
        channel,
        startDate,
        endDate,
        page,
        limit
      }),
      SchoolPayDAO.getStats(ctx)
    ]);

    return NextResponse.json({
      ...txResult,
      stats
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
