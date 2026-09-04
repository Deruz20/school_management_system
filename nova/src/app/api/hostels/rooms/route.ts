import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { HostelDAO } from "@/lib/dao/hostel.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const room = await HostelDAO.createRoom(ctx, {
      hostelId: data.hostelId,
      roomNumber: data.roomNumber,
      floorNumber: data.floorNumber,
      wing: data.wing,
      roomType: data.roomType,
      capacity: data.capacity,
    });

    return NextResponse.json(room, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
