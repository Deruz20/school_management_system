import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { HostelDAO } from "@/lib/dao/hostel.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const clearance = await HostelDAO.recordHostelClearance(ctx, {
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      termId: data.termId,
      mattressReturned: data.mattressReturned,
      roomKeysReturned: data.roomKeysReturned,
      lockerKeysReturned: data.lockerKeysReturned,
      bunkConditionIntact: data.bunkConditionIntact,
      damagesNoted: data.damagesNoted,
      damageCostUGX: data.damageCostUGX,
      damageDescription: data.damageDescription,
    });

    return NextResponse.json(clearance, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
