import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { HostelDAO } from "@/lib/dao/hostel.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const bed = await HostelDAO.createBed(ctx, {
      roomId: data.roomId,
      bedNumber: data.bedNumber,
      bedType: data.bedType,
    });

    return NextResponse.json(bed, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
