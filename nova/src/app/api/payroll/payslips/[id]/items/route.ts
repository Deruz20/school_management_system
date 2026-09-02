import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { PayrollDAO } from '@/lib/dao/payroll.dao';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const updated = await PayrollDAO.adjustDraftPayslipItem(ctx, {
      payslipId: id,
      name: body.name,
      code: body.code,
      type: body.type,
      amount: body.amount,
      isTaxable: body.isTaxable,
      notes: body.notes,
    });

    return NextResponse.json({ payslip: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
