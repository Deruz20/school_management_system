import { NextRequest, NextResponse } from 'next/server';
import { SchoolPayConfigDAO } from '@/lib/dao/schoolpay-config.dao';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET() {
  try {
    const ctx = await requireAuth();
    const config = await SchoolPayConfigDAO.getConfig(ctx);
    return NextResponse.json(config || {});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve configuration';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();
    const updated = await SchoolPayConfigDAO.updateConfig(ctx, body);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update configuration';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
