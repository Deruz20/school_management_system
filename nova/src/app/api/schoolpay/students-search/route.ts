import { NextRequest, NextResponse } from 'next/server';
import { SchoolPayDAO } from '@/lib/dao/schoolpay.dao';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const payerName = searchParams.get('payerName') || undefined;

    const results = await SchoolPayDAO.searchStudentsForAssignment(ctx, query, payerName);
    return NextResponse.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
