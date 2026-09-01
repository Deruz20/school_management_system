import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { StaffDAO } from "@/lib/dao/staff.dao";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const ctx = await requireAuth();
    const data = await req.json();
    const { id } = await params;
    
    const emp = await StaffDAO.update(ctx, id, {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phone: data.phone || null,
      departmentId: data.departmentId || null,
      employeeTypeId: data.employeeTypeId,
      status: data.status
    });
    
    return NextResponse.json(emp);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(message, { status: 400 });
  }
}
