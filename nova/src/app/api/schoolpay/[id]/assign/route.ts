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

    if (!body.studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const result = await SchoolPayDAO.assignAndPostTransaction(
      ctx,
      id,
      body.studentId,
      Boolean(body.linkSchoolPayCode),
      body.reviewNotes
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
