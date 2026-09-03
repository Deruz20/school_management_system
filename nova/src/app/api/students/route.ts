import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { StudentDAO } from "@/lib/dao/student.dao";
import { BoardingStatus, StudentLifecycleStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const classId = url.searchParams.get("classId") || undefined;
    const streamId = url.searchParams.get("streamId") || undefined;
    const lifecycleStatus = (url.searchParams.get("lifecycleStatus") as StudentLifecycleStatus) || undefined;
    const dayOrBoarding = (url.searchParams.get("dayOrBoarding") as BoardingStatus) || undefined;
    const search = url.searchParams.get("search") || undefined;
    const skip = url.searchParams.get("skip") ? parseInt(url.searchParams.get("skip")!) : undefined;
    const take = url.searchParams.get("take") ? parseInt(url.searchParams.get("take")!) : undefined;

    const result = await StudentDAO.getStudents(ctx, {
      classId,
      streamId,
      lifecycleStatus,
      dayOrBoarding,
      search,
      skip,
      take
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const student = await StudentDAO.createStudent(ctx, data);
    return NextResponse.json(student, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
