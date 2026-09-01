import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { EmployeeTypeDAO } from "@/lib/dao/employee-type.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();
    
    const type = await EmployeeTypeDAO.create(ctx, {
      name: data.name,
      description: data.description || null,
      isTeachingStaff: data.isTeachingStaff,
    });
    
    return NextResponse.json(type);
  } catch (err: unknown) {
    console.error('Create type error:', err);
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
