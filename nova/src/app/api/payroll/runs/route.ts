import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { PayrollDAO } from '@/lib/dao/payroll.dao';
import { PayrollStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const status = (searchParams.get('status') as PayrollStatus) || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const runs = await PayrollDAO.listPayrollRuns(ctx, { year, status, limit, offset });
    return NextResponse.json({ runs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const year = parseInt(body.year, 10);
    const month = parseInt(body.month, 10);

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required.' }, { status: 400 });
    }

    const run = await PayrollDAO.generateMonthlyPayrollRun(ctx, {
      year,
      month,
      title: body.title,
    });

    return NextResponse.json({ payrollRun: run }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
