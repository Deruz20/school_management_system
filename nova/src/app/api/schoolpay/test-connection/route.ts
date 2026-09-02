import { NextRequest, NextResponse } from 'next/server';
import { SchoolPayConfigDAO } from '@/lib/dao/schoolpay-config.dao';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine
    }
    const result = await SchoolPayConfigDAO.testConnection(ctx, body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection test failed';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
