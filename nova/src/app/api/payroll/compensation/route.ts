import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { EmployeeCompensationDAO } from '@/lib/dao/employee-compensation.dao';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);

    const employeeId = searchParams.get('employeeId');
    if (employeeId) {
      const comp = await EmployeeCompensationDAO.getCompensationByEmployeeId(ctx, employeeId);
      return NextResponse.json({ compensation: comp });
    }

    const departmentId = searchParams.get('departmentId') || undefined;
    const employeeTypeId = searchParams.get('employeeTypeId') || undefined;
    const search = searchParams.get('search') || undefined;
    const isActive = searchParams.get('isActive') !== null ? searchParams.get('isActive') === 'true' : undefined;

    const compensations = await EmployeeCompensationDAO.listCompensations(ctx, {
      departmentId,
      employeeTypeId,
      search,
      isActive,
    });

    return NextResponse.json({ compensations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();
    const result = await EmployeeCompensationDAO.setCompensation(ctx, body);
    return NextResponse.json({ compensation: result }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
