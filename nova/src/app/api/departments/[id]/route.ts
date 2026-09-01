import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { DepartmentDAO } from "@/lib/dao/department.dao";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const ctx = await requireAuth();
    const data = await req.json();
    const { id } = params;
    
    const dept = await DepartmentDAO.update(ctx, id, {
      name: data.name,
      description: data.description || null,
      hodId: data.hodId || null,
    });
    
    return NextResponse.json(dept);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(message, { status: 400 });
  }
}
