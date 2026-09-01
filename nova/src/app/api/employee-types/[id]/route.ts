import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { EmployeeTypeDAO } from "@/lib/dao/employee-type.dao";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();
    const { id } = await props.params;
    
    const type = await EmployeeTypeDAO.update(ctx, id, {
      name: data.name,
      description: data.description || null,
      isTeachingStaff: data.isTeachingStaff,
    });
    
    return NextResponse.json(type);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(message, { status: 400 });
  }
}
