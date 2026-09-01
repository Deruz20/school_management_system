import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { StaffDAO } from "@/lib/dao/staff.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();
    
    const emp = await StaffDAO.create(ctx, {
      employeeCode: data.employeeCode,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phone: data.phone || undefined,
      departmentId: data.departmentId || undefined,
      employeeTypeId: data.employeeTypeId,
    });
    
    return NextResponse.json(emp);
  } catch (err: unknown) {
    console.error('Create staff error:', err);
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
