import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { HostelDAO } from "@/lib/dao/hostel.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const allocation = await HostelDAO.allocateBed(ctx, {
      studentId: data.studentId,
      bedId: data.bedId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      notes: data.notes,
    });

    return NextResponse.json(allocation, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
