import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { SalaryComponentDAO } from '@/lib/dao/salary-component.dao';

export async function GET() {
  try {
    const ctx = await requireAuth();
    await SalaryComponentDAO.ensureDefaultComponents(ctx);
    const components = await SalaryComponentDAO.listComponents(ctx);
    return NextResponse.json({ components });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();
    const created = await SalaryComponentDAO.createComponent(ctx, body);
    return NextResponse.json({ component: created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
