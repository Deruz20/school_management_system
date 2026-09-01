import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DepartmentDAO } from "@/lib/dao/department.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();
    
    const dept = await DepartmentDAO.create(ctx, {
      name: data.name,
      description: data.description || null,
      hodId: data.hodId || null,
    });
    
    return NextResponse.json(dept);
  } catch (err: unknown) {
    console.error('Create department error:', err);
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
