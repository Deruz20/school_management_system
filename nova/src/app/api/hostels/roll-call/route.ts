import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { HostelDAO } from "@/lib/dao/hostel.dao";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const data = await req.json();

    const results = await HostelDAO.recordRollCall(
      ctx,
      data.hostelId,
      data.date,
      data.items
    );

    return NextResponse.json(results, { status: 201 });
  } catch (err: unknown) {
    return new NextResponse((err as Error).message, { status: 400 });
  }
}
