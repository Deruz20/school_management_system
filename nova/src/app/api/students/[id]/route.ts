import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { StudentDAO } from "@/lib/dao/student.dao";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const student = await StudentDAO.getStudentById(ctx, id);
    return NextResponse.json(student);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAuth();
    const data = await req.json();

    const updated = await StudentDAO.updateStudentProfile(ctx, id, data);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
